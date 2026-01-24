import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect, useMemo } from 'react';
import { 
  LayoutDashboard, Package, ShoppingCart, Users, 
  Settings, Image as ImageIcon, Truck, MessageSquare, 
  Users2, Calendar, FileText, Tag, Loader2, Plus, 
  Search, Edit, Trash2, Mail, Eye,
  CheckCircle, XCircle, AlertCircle, Sparkles,
  RefreshCw, Shield, Globe, Bell, DollarSign,
  TrendingUp, BarChart2, Briefcase, UserPlus,
  Clock, MapPin, FileUp
} from 'lucide-react';
import { 
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area, PieChart, Pie, Cell
} from 'recharts';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase/client';
import { useCurrency } from '@/contexts/CurrencyContext';
import { 
  getGlobalAnalytics, getInventory, getOrders, getAllUsers, 
  getSiteSettings, updateSiteSettings, getInquiries, 
  getPartnerships, getAuthors, getApprovedAuthors, updateProduct, deleteRecord,
  createProduct, updateOrderStatus, updateUserStatus,
  getCategories, getShippingZones, getPromos, togglePromoStatus,
  getCMSContent, updateCMSContent, createCMSContent,
  sendAbandonedCartReminders, updateRecord, createRecord
} from '@/api/dashboards';
import { uploadSiteAsset, uploadProductImage, uploadEbookFile, uploadAgreementFile } from '@/api/storage';
import { getEventRSVPs } from '@/api/community';
import { getNewsletterSubscriptions, updateNewsletterStatus } from '@/api/newsletter';

// Tabs definition
const TABS = [
  { id: 'analytics', label: 'Analytics', icon: LayoutDashboard },
  { id: 'inventory', label: 'Inventory', icon: Package },
  { id: 'orders', label: 'Orders', icon: ShoppingCart },
  { id: 'users', label: 'Users', icon: Users },
  { id: 'settings', label: 'Global Logic', icon: Settings },
  { id: 'identity', label: 'Identity', icon: Globe },
  { id: 'banners', label: 'Banners', icon: ImageIcon },
  { id: 'author_of_day', label: 'Author of the Day', icon: Sparkles },
  { id: 'shipping', label: 'Shipping Methods', icon: Truck },
  { id: 'areas', label: 'City/Area Management', icon: MapPin },
  { id: 'inquiries', label: 'Inquiries', icon: MessageSquare },
  { id: 'clubs', label: 'Clubs', icon: Users2 },
  { id: 'events', label: 'Events', icon: Calendar },
  { id: 'agreements', label: 'Agreements', icon: FileText },
  { id: 'promos', label: 'Promos', icon: Tag },
  { id: 'newsletter', label: 'Newsletter', icon: Mail },
];

export default function FounderDashboard() {
  const { formatPrice } = useCurrency();
  const [activeTab, setActiveTab] = useState('analytics');
  const [isLoading, setIsLoading] = useState(true);
  const [data, setData] = useState<any>({
    analytics: null,
    inventory: [],
    orders: [],
    users: [],
    settings: {},
    inquiries: [],
    partnerships: [],
    authors: [],
    approvedAuthors: [],
    categories: [],
    shippingZones: [],
    promos: [],
    cmsContent: [],
    newsletterSubscriptions: []
  });

  // Fetch all required data
  useEffect(() => {
    fetchAllData();

    // Set up Realtime synchronization for critical tables
    const channel = supabase
      .channel('founder_dashboard_sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => fetchAllData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, () => fetchAllData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => fetchAllData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cms_content' }, () => fetchAllData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shipping_zones' }, () => fetchAllData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'contact_messages' }, () => fetchAllData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'author_applications' }, () => fetchAllData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'partnership_applications' }, () => fetchAllData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'newsletter_subscriptions' }, () => fetchAllData())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchAllData = async () => {
    setIsLoading(true);
    try {
      const results = await Promise.allSettled([
        getGlobalAnalytics(),
        getInventory(),
        getOrders(),
        getAllUsers(),
        getSiteSettings(),
        getInquiries(),
        getPartnerships(),
        getAuthors(),
        getApprovedAuthors(),
        getCategories(),
        getShippingZones(),
        getPromos(),
        getCMSContent(),
        getNewsletterSubscriptions()
      ]);

      const [
        analytics, inventory, orders, users, 
        settings, inquiries, partnerships, 
        authors, approvedAuthors, categories, shippingZones, promos,
        cmsContent, newsletterSubscriptions
      ] = results.map(res => res.status === 'fulfilled' ? res.value : null);

      setData({ 
        analytics: analytics || { total_revenue: 0, total_orders: 0, total_users: 0, total_products: 0, salesData: [], categoryStats: [] },
        inventory: inventory || [],
        orders: orders || [],
        users: users || [],
        settings: settings || {},
        inquiries: inquiries || [],
        partnerships: partnerships || [],
        authors: authors || [],
        approvedAuthors: approvedAuthors || [],
        categories: categories || [],
        shippingZones: shippingZones || [],
        promos: promos || [],
        cmsContent: cmsContent || [],
        newsletterSubscriptions: newsletterSubscriptions || []
      });

      if (results.some(res => res.status === 'rejected')) {
        console.warn('Some dashboard data failed to load:', results.filter(res => res.status === 'rejected'));
        toast.error('Some metrics could not be loaded');
      }
    } catch (error) {
      console.error('Critical failure in dashboard data fetch:', error);
      toast.error('Error loading dashboard data');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGlobalSync = async () => {
    const loadingToast = toast.loading('Synchronizing ecosystem...');
    try {
      await fetchAllData();
      toast.success('Global synchronization successful', { id: loadingToast });
    } catch (error) {
      toast.error('Synchronization failed', { id: loadingToast });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-10 h-10 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/50 flex">
      {/* Sidebar */}
      <aside className="w-72 bg-white border-r border-slate-200 sticky top-0 h-screen flex flex-col">
        <div className="p-8 border-b border-slate-100">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center text-white">
              <Shield className="w-6 h-6" />
            </div>
            <div>
              <h2 className="font-black text-xl tracking-tighter uppercase">Founder</h2>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Sovereign Access</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto p-4 space-y-1 custom-scrollbar">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${
                  activeTab === tab.id 
                  ? 'bg-primary text-white shadow-lg shadow-primary/20' 
                  : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <Icon className="w-5 h-5" />
                {tab.label}
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-100">
          <button 
            onClick={handleGlobalSync}
            className="w-full flex items-center justify-center gap-2 bg-slate-900 text-white py-3 rounded-xl font-bold text-sm hover:bg-slate-800 transition-all shadow-xl shadow-slate-900/10"
          >
            <RefreshCw className="w-4 h-4" />
            Global Sync
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-12 max-w-[1600px] mx-auto overflow-x-hidden">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.2 }}
          >
            {activeTab === 'analytics' && <AnalyticsView data={data.analytics} formatPrice={formatPrice} />}
            {activeTab === 'inventory' && (
              <InventoryView 
                data={data.inventory} 
                categories={data.categories} 
                approvedAuthors={data.approvedAuthors}
                onUpdate={fetchAllData} 
              />
            )}
            {activeTab === 'orders' && <OrdersView data={data.orders} formatPrice={formatPrice} onUpdate={fetchAllData} />}
            {activeTab === 'users' && <UsersView data={data.users} onUpdate={fetchAllData} />}
            {activeTab === 'settings' && <SettingsView settings={data.settings} onUpdate={fetchAllData} />}
            {activeTab === 'identity' && <IdentityView settings={data.settings} onUpdate={fetchAllData} />}
            {activeTab === 'banners' && <BannersView settings={data.settings} cmsContent={data.cmsContent} onUpdate={fetchAllData} />}
            {activeTab === 'author_of_day' && (
              <AuthorOfDayView 
                settings={data.settings} 
                authors={data.approvedAuthors}
                inventory={data.inventory}
                onUpdate={fetchAllData} 
              />
            )}
            {activeTab === 'shipping' && <ShippingView data={data.shippingZones} onUpdate={fetchAllData} />}
            {activeTab === 'areas' && (
              <AreasView 
                data={data.shippingZones} 
                onUpdate={fetchAllData} 
                formatPrice={formatPrice}
              />
            )}
            {activeTab === 'inquiries' && <InquiriesView data={data.inquiries} onUpdate={fetchAllData} />}
            {activeTab === 'clubs' && (
              <ClubsView 
                data={data.cmsContent?.filter((c: any) => c.type === 'book_club') || []} 
                onUpdate={fetchAllData} 
              />
            )}
            {activeTab === 'events' && (
              <EventsView 
                data={data.cmsContent?.filter((c: any) => c.type === 'event') || []} 
                onUpdate={fetchAllData} 
              />
            )}
            {activeTab === 'agreements' && <AgreementsView partnerships={data.partnerships} authors={data.authors} onUpdate={fetchAllData} />}
            {activeTab === 'promos' && <PromosView data={data.promos} onUpdate={fetchAllData} />}
            {activeTab === 'newsletter' && <NewsletterView data={data.newsletterSubscriptions} onUpdate={fetchAllData} />}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}

function AuthorOfDayView({ settings, authors, inventory, onUpdate }: any) {
  const [selectedAuthorId, setSelectedAuthorId] = useState(settings.author_of_the_day_id || '');
  const [isEnabled, setIsEnabled] = useState(settings.author_of_the_day_enabled || false);
  const [selectedBooks, setSelectedBooks] = useState<string[]>(settings.author_of_the_day_books || []);
  const [customImage, setCustomImage] = useState(settings.author_of_the_day_image || '');
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Filter books by selected author
  const authorBooks = useMemo(() => {
    if (!selectedAuthorId) return [];
    return inventory.filter((book: any) => book.author_id === selectedAuthorId);
  }, [selectedAuthorId, inventory]);

  const handleAuthorChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedAuthorId(e.target.value);
    setSelectedBooks([]); // Reset books when author changes
  };

  const handleBookToggle = (bookId: string) => {
    if (selectedBooks.includes(bookId)) {
      setSelectedBooks(selectedBooks.filter(id => id !== bookId));
    } else {
      if (selectedBooks.length >= 5) {
        toast.error('Maximum 5 books can be selected');
        return;
      }
      setSelectedBooks([...selectedBooks, bookId]);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const loadingToast = toast.loading('Uploading author image...');

    try {
      const url = await uploadSiteAsset(file, 'author_of_day');
      setCustomImage(url);
      toast.success('Image uploaded successfully', { id: loadingToast });
    } catch (error) {
      console.error('Upload failed:', error);
      toast.error('Failed to upload image', { id: loadingToast });
    } finally {
      setIsUploading(false);
    }
  };

  const handleSave = async () => {
    if (isEnabled && !selectedAuthorId) {
      toast.error('Please select an author');
      return;
    }

    setIsSaving(true);
    const loadingToast = toast.loading('Saving configuration...');

    try {
      await updateSiteSettings({
        author_of_the_day_id: selectedAuthorId || null,
        author_of_the_day_enabled: isEnabled,
        author_of_the_day_books: selectedBooks,
        author_of_the_day_image: customImage
      });
      toast.success('Author of the Day updated', { id: loadingToast });
      onUpdate();
    } catch (error) {
      console.error('Save failed:', error);
      toast.error('Failed to save configuration', { id: loadingToast });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-black tracking-tighter uppercase mb-2">Author of the Day</h1>
        <p className="text-slate-500 font-medium">Spotlight a featured author on the homepage</p>
      </div>

      <div className="grid lg:grid-cols-2 gap-8">
        {/* Configuration Panel */}
        <div className="space-y-6">
          <div className="bg-white p-8 rounded-[40px] border border-slate-100 shadow-sm space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold">Enable Feature</h3>
                <p className="text-sm text-slate-500">Show this section on the homepage</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={isEnabled}
                  onChange={(e) => setIsEnabled(e.target.checked)}
                  className="sr-only peer" 
                />
                <div className="w-14 h-7 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[4px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-primary"></div>
              </label>
            </div>

            <div className="space-y-4">
              <label className="block text-sm font-bold text-slate-700">Select Author</label>
              <select 
                value={selectedAuthorId}
                onChange={handleAuthorChange}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-primary/20 font-bold transition-all text-sm"
              >
                <option value="">-- Choose an Author --</option>
                {authors.map((author: any) => (
                  <option key={author.id} value={author.id}>{author.full_name} ({author.email})</option>
                ))}
              </select>
            </div>

            <div className="space-y-4">
              <label className="block text-sm font-bold text-slate-700">Custom Feature Image (Optional)</label>
              <div className="flex items-center gap-4">
                {customImage && (
                  <div className="w-20 h-20 rounded-xl overflow-hidden border border-slate-200">
                    <img src={customImage} alt="Feature" className="w-full h-full object-cover" />
                  </div>
                )}
                <label className="flex-1 cursor-pointer group">
                  <div className="flex items-center justify-center gap-2 w-full h-20 border-2 border-dashed border-slate-200 rounded-xl text-slate-400 group-hover:border-primary/50 group-hover:text-primary transition-all">
                    {isUploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <ImageIcon className="w-5 h-5" />}
                    <span className="text-sm font-bold">{isUploading ? 'Uploading...' : 'Upload Image'}</span>
                  </div>
                  <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} disabled={isUploading} />
                </label>
              </div>
              <p className="text-xs text-slate-400">Recommended size: 1200x800px. If not provided, the author's profile picture will be used.</p>
            </div>

            <button 
              onClick={handleSave}
              disabled={isSaving}
              className="w-full bg-slate-900 text-white py-4 rounded-xl font-bold hover:bg-slate-800 transition-all shadow-lg flex items-center justify-center gap-2"
            >
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
              Save Configuration
            </button>
          </div>
        </div>

        {/* Book Selection Panel */}
        <div className="bg-white p-8 rounded-[40px] border border-slate-100 shadow-sm h-fit">
          <div className="mb-6">
            <h3 className="text-lg font-bold">Select Books to Feature</h3>
            <p className="text-sm text-slate-500">Choose 3-5 representative books ({selectedBooks.length} selected)</p>
          </div>

          {!selectedAuthorId ? (
            <div className="text-center py-12 text-slate-400 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
              <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>Please select an author first</p>
            </div>
          ) : authorBooks.length === 0 ? (
            <div className="text-center py-12 text-slate-400 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
              <Package className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>No books found for this author</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[500px] overflow-y-auto custom-scrollbar pr-2">
              {authorBooks.map((book: any) => (
                <div 
                  key={book.id}
                  onClick={() => handleBookToggle(book.id)}
                  className={`flex items-center gap-4 p-3 rounded-xl border cursor-pointer transition-all ${
                    selectedBooks.includes(book.id)
                      ? 'bg-primary/5 border-primary shadow-sm'
                      : 'bg-white border-slate-100 hover:bg-slate-50'
                  }`}
                >
                  <div className={`w-5 h-5 rounded-full border flex items-center justify-center transition-all ${
                    selectedBooks.includes(book.id)
                      ? 'bg-primary border-primary text-white'
                      : 'border-slate-300'
                  }`}>
                    {selectedBooks.includes(book.id) && <CheckCircle className="w-3 h-3" />}
                  </div>
                  <div className="w-10 h-14 bg-slate-100 rounded overflow-hidden flex-shrink-0">
                    {book.image_url ? (
                      <img src={book.image_url} alt={book.title} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-300">
                        <ImageIcon className="w-4 h-4" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-bold text-sm truncate text-slate-900">{book.title}</h4>
                    <p className="text-xs text-slate-500 truncate">{book.category?.name || 'Uncategorized'}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function NewsletterView({ data, onUpdate }: any) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const filteredData = useMemo(() => {
    return data.filter((sub: any) => {
      const matchesSearch = sub.email?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === 'all' || sub.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [data, searchTerm, statusFilter]);

  const handleToggleStatus = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === 'active' ? 'unsubscribed' : 'active';
    const loadingToast = toast.loading(`Updating subscription status...`);
    try {
      await updateNewsletterStatus(id, newStatus);
      toast.success(`Subscription ${newStatus === 'active' ? 'activated' : 'deactivated'}`, { id: loadingToast });
      onUpdate();
    } catch (error) {
      toast.error('Failed to update status', { id: loadingToast });
    }
  };

  const handleExportEmails = () => {
    const activeEmails = data
      .filter((sub: any) => sub.status === 'active')
      .map((sub: any) => sub.email)
      .join('\n');
    
    const blob = new Blob([activeEmails], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `newsletter_subscribers_${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('Active email list exported');
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div>
          <h1 className="text-4xl font-black tracking-tighter uppercase mb-2">Newsletter Management</h1>
          <p className="text-slate-500 font-medium">Subscription stream and audience engagement</p>
        </div>
        
        <div className="flex flex-wrap gap-4 w-full md:w-auto">
          <button 
            onClick={handleExportEmails}
            className="bg-slate-900 text-white px-6 py-3 rounded-xl font-bold text-sm hover:bg-slate-800 transition-all flex items-center gap-2 shadow-lg"
          >
            <FileText className="w-4 h-4" />
            Export Active Emails
          </button>
          <div className="relative flex-1 md:w-64">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search by email..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-white border border-slate-100 rounded-xl outline-none focus:ring-2 focus:ring-primary/20 font-bold transition-all text-sm"
            />
          </div>
          <select 
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-3 bg-white border border-slate-100 rounded-xl outline-none focus:ring-2 focus:ring-primary/20 font-bold transition-all text-sm"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="unsubscribed">Unsubscribed</option>
          </select>
        </div>
      </div>

      <div className="bg-white rounded-[40px] border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-slate-50/50">
                <th className="px-8 py-6 text-left text-[10px] font-black uppercase tracking-widest text-slate-400">Subscriber Email</th>
                <th className="px-8 py-6 text-left text-[10px] font-black uppercase tracking-widest text-slate-400">Join Date</th>
                <th className="px-8 py-6 text-left text-[10px] font-black uppercase tracking-widest text-slate-400">Status</th>
                <th className="px-8 py-6 text-right text-[10px] font-black uppercase tracking-widest text-slate-400">Operations</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredData.map((sub: any) => (
                <tr key={sub.id} className="hover:bg-slate-50/30 transition-all group">
                  <td className="px-8 py-6">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center text-slate-400 group-hover:bg-primary/10 group-hover:text-primary transition-all">
                        <Mail className="w-4 h-4" />
                      </div>
                      <span className="font-bold text-slate-900">{sub.email}</span>
                    </div>
                  </td>
                  <td className="px-8 py-6 font-medium text-slate-500">
                    {new Date(sub.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-8 py-6">
                    <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter ${
                      sub.status === 'active' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'
                    }`}>
                      {sub.status}
                    </span>
                  </td>
                  <td className="px-8 py-6 text-right">
                    <button 
                      onClick={() => handleToggleStatus(sub.id, sub.status)}
                      className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                        sub.status === 'active' 
                          ? 'bg-red-50 text-red-600 hover:bg-red-500 hover:text-white' 
                          : 'bg-green-50 text-green-600 hover:bg-green-500 hover:text-white'
                      }`}
                    >
                      {sub.status === 'active' ? 'Unsubscribe' : 'Activate'}
                    </button>
                  </td>
                </tr>
              ))}
              {filteredData.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-8 py-20 text-center">
                    <Mail className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                    <p className="font-black uppercase tracking-widest text-slate-400">No subscribers found</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// --- View Components ---

function AnalyticsView({ data, formatPrice }: any) {
  if (!data) return null;

  const stats = [
    { label: 'Total Revenue', value: formatPrice(data.totalRevenue), trend: data.revenueTrend, icon: DollarSign, color: 'bg-green-500' },
    { label: 'Total Orders', value: data.totalOrders, trend: data.ordersTrend, icon: ShoppingCart, color: 'bg-blue-500' },
    { label: 'Total Users', value: data.totalUsers, trend: data.usersTrend, icon: Users, color: 'bg-purple-500' },
    { label: 'Total Products', value: data.totalProducts, trend: data.productsTrend, icon: Package, color: 'bg-orange-500' },
  ];

  return (
    <div className="space-y-12">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-4xl font-black tracking-tighter uppercase mb-2">Ecosystem Analytics</h1>
          <p className="text-slate-500 font-medium">Real-time performance and growth metrics</p>
        </div>
        <div className="flex gap-3">
          <select className="bg-white border border-slate-200 px-4 py-2 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-primary/20 transition-all">
            <option>Last 30 Days</option>
            <option>Last 90 Days</option>
            <option>Last 12 Months</option>
            <option>All Time</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="bg-white p-8 rounded-[32px] border border-slate-100 shadow-sm hover:shadow-xl hover:shadow-slate-200/50 transition-all group"
          >
            <div className={`w-12 h-12 ${stat.color} rounded-2xl flex items-center justify-center text-white mb-6 group-hover:scale-110 transition-transform`}>
              <stat.icon className="w-6 h-6" />
            </div>
            <p className="text-slate-400 text-sm font-bold uppercase tracking-wider mb-1">{stat.label}</p>
            <div className="flex items-end justify-between">
              <h3 className="text-3xl font-black tracking-tighter">{stat.value}</h3>
              <span className={`text-xs font-black px-2 py-1 rounded-lg ${
                stat.trend.startsWith('+') ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'
              }`}>
                {stat.trend}
              </span>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-white p-10 rounded-[40px] border border-slate-100 shadow-sm">
          <div className="flex justify-between items-center mb-10">
            <h3 className="text-xl font-black tracking-tighter uppercase">Revenue Trajectory</h3>
            <div className="flex gap-2">
              <div className="flex items-center gap-2 px-3 py-1 bg-green-50 rounded-lg">
                <div className="w-2 h-2 bg-green-500 rounded-full" />
                <span className="text-[10px] font-black uppercase text-green-600">Current</span>
              </div>
            </div>
          </div>
          <div className="h-[400px] w-full min-h-[400px]">
            <ResponsiveContainer width="100%" height="100%" minHeight={400}>
              <AreaChart data={data.salesData}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="created_at" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }}
                  tickFormatter={(val: string) => new Date(val).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }}
                  tickFormatter={(val: number) => formatPrice(val)}
                />
                <Tooltip 
                  contentStyle={{ borderRadius: '20px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)', fontWeight: 700 }}
                />
                <Area type="monotone" dataKey="total_amount" stroke="#8b5cf6" strokeWidth={4} fillOpacity={1} fill="url(#colorRevenue)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-10 rounded-[40px] border border-slate-100 shadow-sm">
          <h3 className="text-xl font-black tracking-tighter uppercase mb-10">Category Saturation</h3>
          <div className="h-[400px] w-full min-h-[400px]">
            <ResponsiveContainer width="100%" height="100%" minHeight={400}>
              <PieChart>
                <Pie
                  data={data.categoryStats}
                  innerRadius={80}
                  outerRadius={120}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {data.categoryStats.map((_: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={['#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ef4444'][index % 5]} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ borderRadius: '20px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)', fontWeight: 700 }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-6 space-y-3">
            {data.categoryStats.slice(0, 4).map((cat: any, i: number) => (
              <div key={cat.name} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${['bg-primary', 'bg-blue-500', 'bg-green-500', 'bg-orange-500'][i % 4]}`} />
                  <span className="text-sm font-bold text-slate-600">{cat.name}</span>
                </div>
                <span className="text-sm font-black text-slate-900">{formatPrice(cat.value)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function InventoryView({ data, categories, approvedAuthors, onUpdate }: any) {
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
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
    type: 'physical',
    weight: '0.5',
    volume: '0.001',
    is_ebook: false,
    ebook_url: '',
    is_active: true,
    metadata: {}
  });

  const filtered = useMemo(() => {
    return data.filter((item: any) => 
      item.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.author?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [data, searchTerm]);

  const handleEdit = (item: any) => {
    setEditingItem(item);
    // Support both direct column and metadata table
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
      type: item.type || 'physical',
      weight: (item.weight || 0.5).toString(),
      volume: (item.volume || 0.001).toString(),
      is_ebook: item.type === 'ebook',
      ebook_url: ebookUrl,
      is_active: item.is_active ?? true,
      metadata: item.metadata || {}
    });
    setIsModalOpen(true);
  };

  const handleAddNew = () => {
    setEditingItem(null);
    setFormData({
      title: '',
      author: '',
      author_id: '',
      price: '',
      sale_price: '',
      stock_quantity: '0',
      category_id: categories[0]?.id || '',
      image_url: '',
      description: '',
      type: 'physical',
      weight: '0.5',
      volume: '0.001',
      is_ebook: false,
      ebook_url: '',
      is_active: true,
      metadata: {}
    });
    setIsModalOpen(true);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const loadingToast = toast.loading('Uploading asset imagery...');
    try {
      const url = await uploadProductImage(file);
      setFormData({ ...formData, image_url: url });
      toast.success('Imagery synchronized', { id: loadingToast });
    } catch (error) {
      toast.error('Upload failed', { id: loadingToast });
    }
  };

  const handleEbookUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      toast.error('Please upload a PDF file for the e-book');
      return;
    }

    const loadingToast = toast.loading('Uploading secure digital asset...');
    try {
      // Use a temporary identifier if we're creating a new product
      const identifier = editingItem?.id || `temp_${Date.now()}`;
      const path = await uploadEbookFile(file, identifier);
      setFormData({ ...formData, ebook_url: path });
      toast.success('Digital asset synchronized', { id: loadingToast });
    } catch (error: any) {
      toast.error(error.message || 'Upload failed', { id: loadingToast });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const loadingToast = toast.loading(editingItem ? 'Updating Asset...' : 'Registering Asset...');
    try {
      const productPayload = {
        ...formData,
        price: parseFloat(formData.price) || 0,
        sale_price: formData.sale_price ? parseFloat(formData.sale_price) : null,
        stock_quantity: parseInt(formData.stock_quantity) || 0,
        category_id: formData.category_id || null,
        author_id: formData.author_id || null,
        weight: parseFloat(formData.weight) || 0.5,
        volume: parseFloat(formData.volume) || 0.001,
        is_ebook: formData.type === 'ebook',
        ebook_metadata: formData.type === 'ebook' ? {
          file_path: formData.ebook_url,
          format: 'pdf',
        } : null
      };

      if (editingItem) {
        await updateProduct(editingItem.id, productPayload);
        toast.success('Asset updated', { id: loadingToast });
      } else {
        await createProduct(productPayload);
        toast.success('Asset registered', { id: loadingToast });
      }
      setIsModalOpen(false);
      onUpdate();
    } catch (error) {
      toast.error('Operation failed', { id: loadingToast });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to decommission this asset?')) return;
    const loadingToast = toast.loading('Decommissioning Asset...');
    try {
      await deleteRecord('products', id);
      toast.success('Asset decommissioned', { id: loadingToast });
      onUpdate();
    } catch (error) {
      toast.error('Failed to decommission', { id: loadingToast });
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-4xl font-black tracking-tighter uppercase mb-2">Inventory Governance</h1>
          <p className="text-slate-500 font-medium">Manage physical books and digital assets</p>
        </div>
        <button 
          onClick={handleAddNew}
          className="bg-primary text-white px-8 py-4 rounded-2xl font-black uppercase tracking-tighter flex items-center gap-2 hover:opacity-90 transition-all shadow-xl shadow-primary/20"
        >
          <Plus className="w-5 h-5" />
          Register New Asset
        </button>
      </div>

      <div className="bg-white rounded-[40px] border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-8 border-b border-slate-50 flex flex-col md:flex-row justify-between gap-6">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search by title, author or ISBN..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-6 py-4 bg-slate-50 rounded-2xl border-none outline-none focus:ring-2 focus:ring-primary/20 font-bold transition-all"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-slate-50/50">
                <th className="px-8 py-6 text-left text-[10px] font-black uppercase tracking-widest text-slate-400">Asset Identity</th>
                <th className="px-8 py-6 text-left text-[10px] font-black uppercase tracking-widest text-slate-400">Type</th>
                <th className="px-8 py-6 text-left text-[10px] font-black uppercase tracking-widest text-slate-400">Valuation</th>
                <th className="px-8 py-6 text-left text-[10px] font-black uppercase tracking-widest text-slate-400">Quantity</th>
                <th className="px-8 py-6 text-left text-[10px] font-black uppercase tracking-widest text-slate-400">Status</th>
                <th className="px-8 py-6 text-right text-[10px] font-black uppercase tracking-widest text-slate-400">Operations</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.map((item: any) => (
                <tr key={item.id} className="hover:bg-slate-50/30 transition-all group">
                  <td className="px-8 py-6">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-16 bg-slate-100 rounded-xl overflow-hidden shadow-sm">
                        <img src={item.image_url} alt={item.title} className="w-full h-full object-cover" />
                      </div>
                      <div>
                        <p className="font-black text-slate-900 group-hover:text-primary transition-colors uppercase tracking-tighter">{item.title}</p>
                        <p className="text-xs font-bold text-slate-400">{item.author || 'Unknown Author'}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-6">
                    <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter ${
                      item.type === 'ebook' ? 'bg-purple-100 text-purple-600' : 'bg-blue-100 text-blue-600'
                    }`}>
                      {item.type === 'ebook' ? 'E-Book' : 'Physical'}
                    </span>
                  </td>
                  <td className="px-8 py-6 font-black text-slate-900">KES {item.price}</td>
                  <td className="px-8 py-6">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${item.stock_quantity < 10 ? 'bg-red-500 animate-pulse' : 'bg-green-500'}`} />
                      <span className="font-bold text-slate-700">{item.stock_quantity} in stock</span>
                    </div>
                  </td>
                  <td className="px-8 py-6">
                    <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter ${
                      item.is_active ? 'bg-green-100 text-green-600' : 'bg-slate-100 text-slate-400'
                    }`}>
                      {item.is_active ? 'Active' : 'Draft'}
                    </span>
                  </td>
                  <td className="px-8 py-6 text-right">
                    <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all">
                      <button 
                        onClick={() => handleEdit(item)}
                        className="p-2 bg-slate-50 text-slate-600 rounded-lg hover:bg-primary hover:text-white transition-all"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => handleDelete(item.id)}
                        className="p-2 bg-slate-50 text-slate-600 rounded-lg hover:bg-red-500 hover:text-white transition-all"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

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
                  <h2 className="text-2xl font-black uppercase tracking-tighter">{editingItem ? 'Edit Asset' : 'Register Asset'}</h2>
                  <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Ecosystem Inventory Protocol</p>
                </div>
                <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-white rounded-full transition-all">
                  <XCircle className="w-8 h-8 text-slate-300 hover:text-red-500" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-10 custom-scrollbar">
                <div className="grid md:grid-cols-2 gap-10">
                  <div className="space-y-6">
                    <div>
                      <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Asset Title</label>
                      <input 
                        required
                        type="text" 
                        value={formData.title}
                        onChange={(e) => setFormData({...formData, title: e.target.value})}
                        className="w-full px-6 py-4 bg-slate-50 rounded-2xl border-none outline-none focus:ring-2 focus:ring-primary/20 font-bold" 
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Primary Author/Creator</label>
                      {approvedAuthors?.length > 0 ? (
                        <select 
                          required
                          value={formData.author_id}
                          onChange={(e) => {
                            const selectedAuthor = approvedAuthors.find((a: any) => a.id === e.target.value);
                            setFormData({
                              ...formData, 
                              author_id: e.target.value,
                              author: selectedAuthor?.full_name || ''
                            });
                          }}
                          className="w-full px-6 py-4 bg-slate-50 rounded-2xl border-none outline-none focus:ring-2 focus:ring-primary/20 font-bold"
                        >
                          <option value="">Select an Author</option>
                          {approvedAuthors.map((author: any) => (
                            <option key={author.id} value={author.id}>{author.full_name}</option>
                          ))}
                        </select>
                      ) : (
                        <input 
                          required
                          type="text" 
                          value={formData.author}
                          onChange={(e) => setFormData({...formData, author: e.target.value})}
                          className="w-full px-6 py-4 bg-slate-50 rounded-2xl border-none outline-none focus:ring-2 focus:ring-primary/20 font-bold" 
                        />
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Standard Price (KES)</label>
                        <input 
                          required
                          type="number" 
                          value={formData.price}
                          onChange={(e) => setFormData({...formData, price: e.target.value})}
                          className="w-full px-6 py-4 bg-slate-50 rounded-2xl border-none outline-none focus:ring-2 focus:ring-primary/20 font-bold" 
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Impact Price (Optional)</label>
                        <input 
                          type="number" 
                          value={formData.sale_price}
                          onChange={(e) => setFormData({...formData, sale_price: e.target.value})}
                          className="w-full px-6 py-4 bg-slate-50 rounded-2xl border-none outline-none focus:ring-2 focus:ring-primary/20 font-bold" 
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Resource Quantity</label>
                        <input 
                          required
                          type="number" 
                          value={formData.stock_quantity}
                          onChange={(e) => setFormData({...formData, stock_quantity: e.target.value})}
                          className="w-full px-6 py-4 bg-slate-50 rounded-2xl border-none outline-none focus:ring-2 focus:ring-primary/20 font-bold" 
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Asset Type</label>
                        <select 
                          value={formData.type}
                          onChange={(e) => setFormData({...formData, type: e.target.value, is_ebook: e.target.value === 'ebook'})}
                          className="w-full px-6 py-4 bg-slate-50 rounded-2xl border-none outline-none focus:ring-2 focus:ring-primary/20 font-bold"
                        >
                          <option value="physical">Physical Manuscript</option>
                          <option value="ebook">Digital E-Book</option>
                        </select>
                      </div>
                    </div>

                    {formData.type === 'physical' && (
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Weight (KG)</label>
                          <input 
                            type="number" 
                            step="0.001"
                            value={formData.weight}
                            onChange={(e) => setFormData({...formData, weight: e.target.value})}
                            className="w-full px-6 py-4 bg-slate-50 rounded-2xl border-none outline-none focus:ring-2 focus:ring-primary/20 font-bold" 
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Volume (m³)</label>
                          <input 
                            type="number" 
                            step="0.000001"
                            value={formData.volume}
                            onChange={(e) => setFormData({...formData, volume: e.target.value})}
                            className="w-full px-6 py-4 bg-slate-50 rounded-2xl border-none outline-none focus:ring-2 focus:ring-primary/20 font-bold" 
                          />
                        </div>
                      </div>
                    )}

                    {formData.type === 'ebook' && (
                      <motion.div 
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="p-6 bg-purple-50 rounded-3xl border-2 border-purple-100 space-y-4"
                      >
                        <h4 className="text-[10px] font-black uppercase tracking-widest text-purple-400">Digital Distribution Protocol</h4>
                        <div className="space-y-4">
                          <div>
                            <label className="block text-[10px] font-black uppercase tracking-widest text-purple-300 mb-2">E-Book Secure Path / URL</label>
                            <div className="flex gap-2">
                              <input 
                                type="text" 
                                placeholder="Path in ebooks bucket..."
                                value={formData.ebook_url}
                                onChange={(e) => setFormData({...formData, ebook_url: e.target.value})}
                                className="flex-1 px-6 py-4 bg-white rounded-2xl border-none outline-none focus:ring-2 focus:ring-purple-200 font-bold text-purple-900" 
                              />
                              <label className="cursor-pointer bg-purple-500 text-white p-4 rounded-2xl hover:bg-purple-600 transition-all shadow-lg shadow-purple-200">
                                <FileUp className="w-6 h-6" />
                                <input 
                                  type="file" 
                                  accept=".pdf" 
                                  onChange={handleEbookUpload} 
                                  className="hidden" 
                                />
                              </label>
                            </div>
                            {formData.ebook_url && (
                              <p className="mt-2 text-[10px] font-bold text-purple-400 truncate">
                                Current path: {formData.ebook_url}
                              </p>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </div>

                  <div className="space-y-6">
                    <div>
                      <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Asset Imagery</label>
                      <div className="aspect-[3/4] bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200 overflow-hidden relative group">
                        {formData.image_url ? (
                          <>
                            <img src={formData.image_url} alt="Preview" className="w-full h-full object-cover" />
                            <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center">
                              <label htmlFor="asset-upload" className="cursor-pointer bg-white text-slate-900 px-6 py-2 rounded-full font-black text-xs uppercase tracking-widest">Change Image</label>
                            </div>
                          </>
                        ) : (
                          <label htmlFor="asset-upload" className="absolute inset-0 flex flex-col items-center justify-center cursor-pointer hover:bg-slate-100 transition-all">
                            <ImageIcon className="w-12 h-12 text-slate-300 mb-2" />
                            <span className="font-bold text-xs text-slate-400 uppercase tracking-widest">Upload Imagery</span>
                          </label>
                        )}
                        <input id="asset-upload" type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Classification</label>
                      <select 
                        required
                        value={formData.category_id}
                        onChange={(e) => setFormData({...formData, category_id: e.target.value})}
                        className="w-full px-6 py-4 bg-slate-50 rounded-2xl border-none outline-none focus:ring-2 focus:ring-primary/20 font-bold"
                      >
                        {categories.map((cat: any) => (
                          <option key={cat.id} value={cat.id}>{cat.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Protocol Status</label>
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, is_active: !formData.is_active })}
                        className={`w-full flex items-center justify-between px-6 py-4 rounded-2xl font-bold transition-all ${
                          formData.is_active 
                            ? 'bg-green-50 text-green-600 border-2 border-green-100' 
                            : 'bg-slate-50 text-slate-400 border-2 border-slate-100'
                        }`}
                      >
                        <span className="uppercase tracking-widest text-[10px]">Asset is {formData.is_active ? 'Active' : 'Draft'}</span>
                        <div className={`w-10 h-5 rounded-full relative transition-all ${formData.is_active ? 'bg-green-500' : 'bg-slate-300'}`}>
                          <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${formData.is_active ? 'left-6' : 'left-1'}`} />
                        </div>
                      </button>
                    </div>
                  </div>
                </div>

                <div className="mt-10">
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Asset Description / Narrative</label>
                  <textarea 
                    value={formData.description}
                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                    className="w-full px-6 py-4 bg-slate-50 rounded-2xl border-none outline-none focus:ring-2 focus:ring-primary/20 font-bold h-40 resize-none"
                    placeholder="Describe the asset's impact and contents..."
                  />
                </div>

                <div className="mt-12 flex gap-4">
                  <button 
                    type="submit"
                    className="flex-1 bg-primary text-white py-6 rounded-[32px] font-black uppercase tracking-widest shadow-2xl shadow-primary/30 hover:scale-[1.02] active:scale-[0.98] transition-all"
                  >
                    {editingItem ? 'Update Protocol Asset' : 'Register New Protocol Asset'}
                  </button>
                  <button 
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-12 bg-slate-100 text-slate-600 py-6 rounded-[32px] font-black uppercase tracking-widest hover:bg-slate-200 transition-all"
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

function OrdersView({ data, formatPrice, onUpdate }: any) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  
  const filtered = useMemo(() => {
    return data.filter((order: any) => 
      order.id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.customer_email?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [data, searchTerm]);

  const handleUpdateStatus = async (orderId: string, status: string) => {
    const loadingToast = toast.loading(`Transitioning order to ${status}...`);
    try {
      await updateOrderStatus(orderId, status);
      toast.success(`Order status synchronized: ${status}`, { id: loadingToast });
      onUpdate();
    } catch (error) {
      toast.error('Status transition failed', { id: loadingToast });
    }
  };

  const handleSendReminders = async () => {
    const loadingToast = toast.loading('Dispatching reminders...');
    try {
      const result = await sendAbandonedCartReminders();
      toast.success(`Sent ${result.sentCount} reminders`, { id: loadingToast });
    } catch (error) {
      toast.error('Dispatch failed', { id: loadingToast });
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-4xl font-black tracking-tighter uppercase mb-2">Order Fulfillment</h1>
          <p className="text-slate-500 font-medium">Track and process customer acquisitions</p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={handleSendReminders}
            className="bg-white border border-slate-200 text-slate-900 px-6 py-4 rounded-2xl font-bold uppercase tracking-tighter flex items-center gap-2 hover:bg-slate-50 transition-all"
          >
            <Bell className="w-5 h-5" />
            Remind Carts
          </button>
          <button className="bg-slate-900 text-white px-8 py-4 rounded-2xl font-black uppercase tracking-tighter flex items-center gap-2 hover:opacity-90 transition-all shadow-xl shadow-slate-900/20">
            Export Manifest
          </button>
        </div>
      </div>

      <div className="bg-white rounded-[40px] border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-8 border-b border-slate-50">
          <div className="relative max-w-md">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search by Order ID or Email..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-6 py-4 bg-slate-50 rounded-2xl border-none outline-none focus:ring-2 focus:ring-primary/20 font-bold transition-all"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-slate-50/50">
                <th className="px-8 py-6 text-left text-[10px] font-black uppercase tracking-widest text-slate-400">Order Token</th>
                <th className="px-8 py-6 text-left text-[10px] font-black uppercase tracking-widest text-slate-400">Acquirer</th>
                <th className="px-8 py-6 text-left text-[10px] font-black uppercase tracking-widest text-slate-400">Total Valuation</th>
                <th className="px-8 py-6 text-left text-[10px] font-black uppercase tracking-widest text-slate-400">Fulfillment Status</th>
                <th className="px-8 py-6 text-left text-[10px] font-black uppercase tracking-widest text-slate-400">Temporal Stamp</th>
                <th className="px-8 py-6 text-right text-[10px] font-black uppercase tracking-widest text-slate-400">Operations</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.map((order: any) => (
                <tr key={order.id} className="hover:bg-slate-50/30 transition-all group">
                  <td className="px-8 py-6 font-black text-slate-900">#ORD-{order.id.slice(0, 8).toUpperCase()}</td>
                  <td className="px-8 py-6">
                    <p className="font-bold text-slate-900">{order.customer_name || 'Anonymous'}</p>
                    <p className="text-xs font-bold text-slate-400">{order.customer_email}</p>
                  </td>
                  <td className="px-8 py-6 font-black text-slate-900">{formatPrice(order.total_amount)}</td>
                  <td className="px-8 py-6">
                    <select 
                      value={order.status}
                      onChange={(e) => handleUpdateStatus(order.id, e.target.value)}
                      className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter outline-none border-none cursor-pointer ${
                        order.status === 'completed' ? 'bg-green-100 text-green-600' :
                        order.status === 'processing' ? 'bg-blue-100 text-blue-600' :
                        order.status === 'pending' ? 'bg-orange-100 text-orange-600' :
                        'bg-slate-100 text-slate-600'
                      }`}
                    >
                      <option value="pending">Pending</option>
                      <option value="processing">Processing</option>
                      <option value="shipped">Shipped</option>
                      <option value="delivered">Delivered</option>
                      <option value="completed">Completed</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                  </td>
                  <td className="px-8 py-6 text-slate-500 font-bold text-sm">
                    {new Date(order.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-8 py-6 text-right">
                    <button 
                      onClick={() => setSelectedOrder(order)}
                      className="text-primary font-black uppercase text-[10px] tracking-widest hover:underline"
                    >
                      Review Details
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <AnimatePresence>
        {selectedOrder && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedOrder(null)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative bg-white w-full max-w-2xl rounded-[40px] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="p-8 border-b border-slate-50 flex justify-between items-center bg-slate-50/50">
                <div>
                  <h2 className="text-2xl font-black uppercase tracking-tighter">Order Details</h2>
                  <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Token: #ORD-{selectedOrder.id.slice(0, 8).toUpperCase()}</p>
                </div>
                <button onClick={() => setSelectedOrder(null)} className="p-2 hover:bg-white rounded-full transition-all">
                  <XCircle className="w-8 h-8 text-slate-300 hover:text-red-500" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-10 space-y-8 custom-scrollbar">
                <div className="grid md:grid-cols-2 gap-8">
                  <div className="space-y-4">
                    <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Acquirer Intelligence</h3>
                    <div className="bg-slate-50 p-6 rounded-3xl">
                      <p className="font-black text-slate-900">{selectedOrder.customer_name || 'Anonymous'}</p>
                      <p className="font-bold text-slate-500 text-sm">{selectedOrder.customer_email}</p>
                      <p className="font-bold text-slate-500 text-sm mt-2">{selectedOrder.shipping_address}</p>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Fulfillment Status</h3>
                    <div className="bg-slate-50 p-6 rounded-3xl">
                      <div className="flex items-center gap-2 mb-2">
                        <Clock className="w-4 h-4 text-primary" />
                        <span className="font-black text-slate-900 uppercase text-xs">{selectedOrder.status}</span>
                      </div>
                      <p className="text-xs font-bold text-slate-400">Received: {new Date(selectedOrder.created_at).toLocaleString()}</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Acquisition Items</h3>
                  <div className="space-y-3">
                    {selectedOrder.order_items?.map((item: any) => (
                      <div key={item.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-16 bg-white rounded-lg border border-slate-100 overflow-hidden">
                            {item.product?.image_url && <img src={item.product.image_url} alt="" className="w-full h-full object-cover" />}
                          </div>
                          <div>
                            <p className="font-black text-slate-900 text-sm">{item.product?.title || 'Unknown Product'}</p>
                            <p className="text-[10px] font-bold text-slate-400 uppercase">Qty: {item.quantity}</p>
                          </div>
                        </div>
                        <p className="font-black text-slate-900">{formatPrice(item.unit_price * item.quantity)}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pt-6 border-t border-slate-100 space-y-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Subtotal (Excl. VAT)</span>
                    <span className="font-bold text-slate-600">{formatPrice(selectedOrder.subtotal_amount)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Shipping Fee</span>
                    <span className="font-bold text-slate-600">{formatPrice(selectedOrder.shipping_amount)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">VAT (Computed)</span>
                    <span className="font-bold text-slate-600">{formatPrice(selectedOrder.tax_amount)}</span>
                  </div>
                  <div className="pt-4 border-t border-slate-100 flex justify-between items-end">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Total Valuation (Incl. VAT)</p>
                      <h3 className="text-3xl font-black text-primary">{formatPrice(selectedOrder.total_amount)}</h3>
                    </div>
                    <button 
                      onClick={() => {
                        const status = selectedOrder.status === 'pending' ? 'processing' : 'completed';
                        handleUpdateStatus(selectedOrder.id, status);
                        setSelectedOrder(null);
                      }}
                      className="bg-slate-900 text-white px-8 py-4 rounded-2xl font-black uppercase tracking-tighter hover:opacity-90 transition-all"
                    >
                      Transition to {selectedOrder.status === 'pending' ? 'Processing' : 'Completed'}
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function UsersView({ data }: any) {
  const [searchTerm, setSearchTerm] = useState('');
  
  const filtered = useMemo(() => {
    return data.filter((user: any) => 
      user.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [data, searchTerm]);

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-4xl font-black tracking-tighter uppercase mb-2">Demographic Intelligence</h1>
          <p className="text-slate-500 font-medium">Monitor user base and authority levels</p>
        </div>
        <button className="bg-primary text-white px-8 py-4 rounded-2xl font-black uppercase tracking-tighter flex items-center gap-2 hover:opacity-90 transition-all shadow-xl shadow-primary/20">
          <UserPlus className="w-5 h-5" />
          Register Protocol User
        </button>
      </div>

      <div className="bg-white rounded-[40px] border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-8 border-b border-slate-50">
          <div className="relative max-w-md">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search users by name, email, or role..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-6 py-4 bg-slate-50 rounded-2xl border-none outline-none focus:ring-2 focus:ring-primary/20 font-bold transition-all"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-slate-50/50">
                <th className="px-8 py-6 text-left text-[10px] font-black uppercase tracking-widest text-slate-400">User Profile</th>
                <th className="px-8 py-6 text-left text-[10px] font-black uppercase tracking-widest text-slate-400">Authority Level</th>
                <th className="px-8 py-6 text-left text-[10px] font-black uppercase tracking-widest text-slate-400">Membership</th>
                <th className="px-8 py-6 text-left text-[10px] font-black uppercase tracking-widest text-slate-400">Active Status</th>
                <th className="px-8 py-6 text-right text-[10px] font-black uppercase tracking-widest text-slate-400">Security Operations</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.map((user: any) => (
                <tr key={user.id} className="hover:bg-slate-50/30 transition-all group">
                  <td className="px-8 py-6">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center font-black text-slate-400">
                        {user.full_name?.charAt(0) || user.email?.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-black text-slate-900">{user.full_name || 'Anonymous Entity'}</p>
                        <p className="text-xs font-bold text-slate-400">{user.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-6">
                    <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter ${
                      user.role === 'founder' ? 'bg-red-100 text-red-600' :
                      user.role === 'admin' ? 'bg-orange-100 text-orange-600' :
                      user.role === 'author' ? 'bg-blue-100 text-blue-600' :
                      'bg-slate-100 text-slate-600'
                    }`}>
                      {user.role}
                    </span>
                  </td>
                  <td className="px-8 py-6">
                    <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter ${
                      user.membership_type === 'premium' ? 'bg-yellow-100 text-yellow-600' : 'bg-slate-100 text-slate-400'
                    }`}>
                      {user.membership_type || 'Standard User'}
                    </span>
                  </td>
                  <td className="px-8 py-6">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${user.is_active ? 'bg-green-500' : 'bg-red-500'}`} />
                      <span className="font-bold text-slate-700">{user.is_active ? 'Authorized' : 'Suspended'}</span>
                    </div>
                  </td>
                  <td className="px-8 py-6 text-right">
                    <div className="flex justify-end gap-2">
                      <button 
                        onClick={() => updateUserStatus(user.id, !user.is_active)}
                        className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
                          user.is_active ? 'bg-red-50 text-red-600 hover:bg-red-600 hover:text-white' : 'bg-green-50 text-green-600 hover:bg-green-600 hover:text-white'
                        }`}
                      >
                        {user.is_active ? 'Suspend' : 'Authorize'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function SettingsView({ settings, onUpdate }: any) {
  const [formData, setFormData] = useState(settings);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const loadingToast = toast.loading('Updating Global Logic...');
    try {
      await updateSiteSettings(formData);
      toast.success('Settings updated successfully', { id: loadingToast });
      onUpdate();
    } catch (error) {
      toast.error('Failed to update settings', { id: loadingToast });
    }
  };

  return (
    <div className="space-y-12">
      <div>
        <h1 className="text-4xl font-black tracking-tighter uppercase mb-2">Global Logic Sovereignty</h1>
        <p className="text-slate-500 font-medium">Fundamental ecosystem parameters and control overrides</p>
      </div>

      <form onSubmit={handleSubmit} className="grid lg:grid-cols-2 gap-8">
        <div className="space-y-8">
          <div className="bg-white p-10 rounded-[40px] border border-slate-100 shadow-sm">
            <h3 className="text-xl font-black tracking-tighter uppercase mb-8 flex items-center gap-2">
              <BarChart2 className="w-6 h-6 text-primary" />
              Fundamental Math
            </h3>
            <div className="space-y-6">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Base Tax Rate (%)</label>
                <input 
                  type="number" 
                  value={formData.tax_rate}
                  onChange={(e) => setFormData({...formData, tax_rate: e.target.value})}
                  className="w-full px-6 py-4 bg-slate-50 rounded-2xl border-none outline-none focus:ring-2 focus:ring-primary/20 font-bold transition-all" 
                />
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Default Currency</label>
                <select 
                  value={formData.default_currency}
                  onChange={(e) => setFormData({...formData, default_currency: e.target.value})}
                  className="w-full px-6 py-4 bg-slate-50 rounded-2xl border-none outline-none focus:ring-2 focus:ring-primary/20 font-bold transition-all"
                >
                  <option value="KES">KES (Kenya Shilling)</option>
                  <option value="USD">USD (US Dollar)</option>
                </select>
              </div>
            </div>
          </div>

          <div className="bg-white p-10 rounded-[40px] border border-slate-100 shadow-sm">
            <h3 className="text-xl font-black tracking-tighter uppercase mb-8 flex items-center gap-2">
              <Bell className="w-6 h-6 text-primary" />
              Global Announcement Intelligence
            </h3>
            <div className="space-y-6">
              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl">
                <div>
                  <p className="font-bold text-slate-900">Broadcasting Status</p>
                  <p className="text-xs text-slate-500 font-medium">Display a global notification to all users</p>
                </div>
                <button 
                  type="button"
                  onClick={() => setFormData({...formData, announcement_active: !formData.announcement_active})}
                  className={`w-14 h-8 rounded-full transition-all relative ${formData.announcement_active ? 'bg-primary' : 'bg-slate-200'}`}
                >
                  <div className={`absolute top-1 w-6 h-6 bg-white rounded-full transition-all ${formData.announcement_active ? 'right-1' : 'left-1'}`} />
                </button>
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Announcement Payload</label>
                <textarea 
                  value={formData.global_announcement}
                  onChange={(e) => setFormData({...formData, global_announcement: e.target.value})}
                  className="w-full px-6 py-4 bg-slate-50 rounded-2xl border-none outline-none focus:ring-2 focus:ring-primary/20 font-bold transition-all h-32 resize-none"
                  placeholder="Type your global message here..."
                />
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-8">
          <div className="bg-white p-10 rounded-[40px] border border-slate-100 shadow-sm border-red-100">
            <h3 className="text-xl font-black tracking-tighter uppercase mb-8 flex items-center gap-2 text-red-600">
              <AlertCircle className="w-6 h-6" />
              Critical Overrides
            </h3>
            <div className="space-y-6">
              <div className="flex items-center justify-between p-6 bg-red-50 rounded-[32px] border border-red-100">
                <div>
                  <p className="font-black text-red-600 uppercase tracking-tighter">Maintenance Mode</p>
                  <p className="text-xs text-red-500 font-bold">Suspend all customer operations immediately</p>
                </div>
                <button 
                  type="button"
                  onClick={() => setFormData({...formData, maintenance_mode: !formData.maintenance_mode})}
                  className={`w-14 h-8 rounded-full transition-all relative ${formData.maintenance_mode ? 'bg-red-600' : 'bg-slate-200'}`}
                >
                  <div className={`absolute top-1 w-6 h-6 bg-white rounded-full transition-all ${formData.maintenance_mode ? 'right-1' : 'left-1'}`} />
                </button>
              </div>
              <div className="p-6 bg-slate-50 rounded-[32px] border border-slate-100">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4">Membership Payment Wall</p>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-bold text-slate-900">Gate exclusive content</p>
                    <p className="text-xs text-slate-500 font-medium">Enable/Disable membership paywall</p>
                  </div>
                  <button 
                    type="button"
                    onClick={() => setFormData({...formData, membership_wall_active: !formData.membership_wall_active})}
                    className={`w-14 h-8 rounded-full transition-all relative ${formData.membership_wall_active ? 'bg-primary' : 'bg-slate-200'}`}
                  >
                    <div className={`absolute top-1 w-6 h-6 bg-white rounded-full transition-all ${formData.membership_wall_active ? 'right-1' : 'left-1'}`} />
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white p-10 rounded-[40px] border border-slate-100 shadow-sm">
            <h3 className="text-xl font-black tracking-tighter uppercase mb-8 flex items-center gap-2">
              <Shield className="w-6 h-6 text-primary" />
              Membership Infrastructure
            </h3>
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Membership Price (KES)</label>
                  <input 
                    type="number" 
                    value={formData.membership_price}
                    onChange={(e) => setFormData({...formData, membership_price: e.target.value})}
                    className="w-full px-6 py-4 bg-slate-50 rounded-2xl border-none outline-none focus:ring-2 focus:ring-primary/20 font-bold transition-all" 
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Duration (Days)</label>
                  <input 
                    type="number" 
                    value={formData.membership_duration_days}
                    onChange={(e) => setFormData({...formData, membership_duration_days: e.target.value})}
                    className="w-full px-6 py-4 bg-slate-50 rounded-2xl border-none outline-none focus:ring-2 focus:ring-primary/20 font-bold transition-all" 
                  />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Wall Title</label>
                <input 
                  type="text" 
                  value={formData.membership_title}
                  onChange={(e) => setFormData({...formData, membership_title: e.target.value})}
                  className="w-full px-6 py-4 bg-slate-50 rounded-2xl border-none outline-none focus:ring-2 focus:ring-primary/20 font-bold transition-all" 
                />
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Wall Description</label>
                <textarea 
                  value={formData.membership_description}
                  onChange={(e) => setFormData({...formData, membership_description: e.target.value})}
                  className="w-full px-6 py-4 bg-slate-50 rounded-2xl border-none outline-none focus:ring-2 focus:ring-primary/20 font-bold transition-all h-24 resize-none" 
                />
              </div>
            </div>
          </div>

          <button 
            type="submit"
            className="w-full bg-primary text-white py-6 rounded-[32px] font-black uppercase tracking-widest shadow-2xl shadow-primary/30 hover:scale-[1.02] active:scale-[0.98] transition-all"
          >
            Commit Global Settings
          </button>
        </div>
      </form>
    </div>
  );
}

function IdentityView({ settings, onUpdate }: any) {
  const [formData, setFormData] = useState(settings);
  const [isUploading, setIsUploading] = useState(false);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, field: string) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const loadingToast = toast.loading('Uploading asset...');
    try {
      const url = await uploadSiteAsset(file);
      setFormData({ ...formData, [field]: url });
      toast.success('Asset uploaded successfully', { id: loadingToast });
    } catch (error) {
      toast.error('Upload failed', { id: loadingToast });
    } finally {
      setIsUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const loadingToast = toast.loading('Synchronizing Identity...');
    try {
      await updateSiteSettings(formData);
      toast.success('Identity updated', { id: loadingToast });
      onUpdate();
    } catch (error) {
      toast.error('Sync failed', { id: loadingToast });
    }
  };

  return (
    <div className="space-y-12">
      <div>
        <h1 className="text-4xl font-black tracking-tighter uppercase mb-2">Identity and Connectivity Governance</h1>
        <p className="text-slate-500 font-medium">Manage platform brand and digital contact nodes</p>
      </div>

      <form onSubmit={handleSubmit} className="grid lg:grid-cols-2 gap-8">
        <div className="bg-white p-10 rounded-[40px] border border-slate-100 shadow-sm">
          <h3 className="text-xl font-black tracking-tighter uppercase mb-8 flex items-center gap-2">
            <Globe className="w-6 h-6 text-primary" />
            Platform Identity
          </h3>
          <div className="space-y-6">
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Site Logo</label>
              <div className="flex items-center gap-4">
                {formData.site_logo && (
                  <div className="w-16 h-16 rounded-xl bg-slate-50 border border-slate-100 overflow-hidden">
                    <img src={formData.site_logo} alt="Logo Preview" className="w-full h-full object-contain" />
                  </div>
                )}
                <div className="flex-1">
                  <input 
                    type="file" 
                    accept="image/*"
                    onChange={(e) => handleFileUpload(e, 'site_logo')}
                    className="hidden" 
                    id="logo-upload"
                  />
                  <label 
                    htmlFor="logo-upload"
                    className="flex items-center justify-center gap-2 w-full px-6 py-4 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200 hover:border-primary/50 hover:bg-primary/5 cursor-pointer transition-all font-bold text-sm text-slate-500"
                  >
                    <ImageIcon className="w-5 h-5" />
                    {isUploading ? 'Uploading...' : 'Change Logo Asset'}
                  </label>
                </div>
              </div>
            </div>
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Platform Name</label>
              <input 
                type="text" 
                value={formData.site_name}
                onChange={(e) => setFormData({...formData, site_name: e.target.value})}
                className="w-full px-6 py-4 bg-slate-50 rounded-2xl border-none outline-none focus:ring-2 focus:ring-primary/20 font-bold transition-all" 
              />
            </div>
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Support Email</label>
              <input 
                type="email" 
                value={formData.contact_email}
                onChange={(e) => setFormData({...formData, contact_email: e.target.value})}
                className="w-full px-6 py-4 bg-slate-50 rounded-2xl border-none outline-none focus:ring-2 focus:ring-primary/20 font-bold transition-all" 
                placeholder="hello@readmart.com"
              />
            </div>
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Support Phone</label>
              <input 
                type="text" 
                value={formData.contact_phone}
                onChange={(e) => setFormData({...formData, contact_phone: e.target.value})}
                className="w-full px-6 py-4 bg-slate-50 rounded-2xl border-none outline-none focus:ring-2 focus:ring-primary/20 font-bold transition-all" 
                placeholder="+254 794 129 958"
              />
            </div>
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Global Support WhatsApp</label>
              <input 
                type="text" 
                value={formData.whatsapp_link}
                onChange={(e) => setFormData({...formData, whatsapp_link: e.target.value})}
                className="w-full px-6 py-4 bg-slate-50 rounded-2xl border-none outline-none focus:ring-2 focus:ring-primary/20 font-bold transition-all" 
              />
            </div>
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Headquarters Address</label>
              <textarea 
                value={formData.address}
                onChange={(e) => setFormData({...formData, address: e.target.value})}
                className="w-full px-6 py-4 bg-slate-50 rounded-2xl border-none outline-none focus:ring-2 focus:ring-primary/20 font-bold transition-all h-24 resize-none" 
              />
            </div>
          </div>
        </div>

        <div className="bg-white p-10 rounded-[40px] border border-slate-100 shadow-sm">
          <h3 className="text-xl font-black tracking-tighter uppercase mb-8 flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-primary" />
            Social Connectivity Hub
          </h3>
          <div className="space-y-6">
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Instagram Intelligence</label>
              <input 
                type="text" 
                value={formData.instagram_url}
                onChange={(e) => setFormData({...formData, instagram_url: e.target.value})}
                className="w-full px-6 py-4 bg-slate-50 rounded-2xl border-none outline-none focus:ring-2 focus:ring-primary/20 font-bold transition-all" 
                placeholder="https://instagram.com/..."
              />
            </div>
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Facebook Node</label>
              <input 
                type="text" 
                value={formData.facebook_url}
                onChange={(e) => setFormData({...formData, facebook_url: e.target.value})}
                className="w-full px-6 py-4 bg-slate-50 rounded-2xl border-none outline-none focus:ring-2 focus:ring-primary/20 font-bold transition-all" 
                placeholder="https://facebook.com/..."
              />
            </div>
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">X (Twitter) Signal</label>
              <input 
                type="text" 
                value={formData.x_url}
                onChange={(e) => setFormData({...formData, x_url: e.target.value})}
                className="w-full px-6 py-4 bg-slate-50 rounded-2xl border-none outline-none focus:ring-2 focus:ring-primary/20 font-bold transition-all" 
                placeholder="https://x.com/..."
              />
            </div>
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">LinkedIn Network</label>
              <input 
                type="text" 
                value={formData.linkedin_url}
                onChange={(e) => setFormData({...formData, linkedin_url: e.target.value})}
                className="w-full px-6 py-4 bg-slate-50 rounded-2xl border-none outline-none focus:ring-2 focus:ring-primary/20 font-bold transition-all" 
                placeholder="https://linkedin.com/..."
              />
            </div>
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">YouTube Channel</label>
              <input 
                type="text" 
                value={formData.youtube_url}
                onChange={(e) => setFormData({...formData, youtube_url: e.target.value})}
                className="w-full px-6 py-4 bg-slate-50 rounded-2xl border-none outline-none focus:ring-2 focus:ring-primary/20 font-bold transition-all" 
                placeholder="https://youtube.com/@..."
              />
            </div>
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Threads Pulse</label>
              <input 
                type="text" 
                value={formData.threads_url}
                onChange={(e) => setFormData({...formData, threads_url: e.target.value})}
                className="w-full px-6 py-4 bg-slate-50 rounded-2xl border-none outline-none focus:ring-2 focus:ring-primary/20 font-bold transition-all" 
                placeholder="https://threads.net/@..."
              />
            </div>
            <button 
              type="submit"
              className="w-full bg-slate-900 text-white py-6 rounded-[32px] font-black uppercase tracking-widest shadow-2xl shadow-slate-900/30 hover:scale-[1.02] active:scale-[0.98] transition-all mt-6"
            >
              Commit Identity Settings
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

function BannersView({ settings, cmsContent, onUpdate }: any) {
  const [heroFormData, setHeroFormData] = useState(settings);
  const [isUploadingHero, setIsUploadingHero] = useState(false);
  
  // Promotional Banners State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBanner, setEditingBanner] = useState<any>(null);
  const [isUploadingBanner, setIsUploadingBanner] = useState(false);
  const [bannerFormData, setBannerFormData] = useState({
    type: 'banner',
    title: '',
    content: '',
    image_url: '',
    link_url: '',
    is_active: true
  });

  const banners = useMemo(() => cmsContent.filter((c: any) => c.type === 'banner'), [cmsContent]);

  const handleHeroUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingHero(true);
    const loadingToast = toast.loading('Uploading hero asset...');
    try {
      const url = await uploadSiteAsset(file);
      setHeroFormData({ ...heroFormData, hero_image_url: url });
      toast.success('Hero imagery synchronized', { id: loadingToast });
    } catch (error) {
      toast.error('Upload failed', { id: loadingToast });
    } finally {
      setIsUploadingHero(false);
    }
  };

  const handleHeroSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const loadingToast = toast.loading('Synchronizing Visuals...');
    try {
      await updateSiteSettings(heroFormData);
      toast.success('Hero section updated', { id: loadingToast });
      onUpdate();
    } catch (error) {
      toast.error('Sync failed', { id: loadingToast });
    }
  };

  const handleBannerUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingBanner(true);
    const loadingToast = toast.loading('Uploading banner asset...');
    try {
      const url = await uploadSiteAsset(file);
      setBannerFormData(prev => ({ ...prev, image_url: url }));
      toast.success('Banner asset synchronized', { id: loadingToast });
    } catch (error) {
      toast.error('Upload failed', { id: loadingToast });
    } finally {
      setIsUploadingBanner(false);
    }
  };

  const handleEditBanner = (banner: any) => {
    setEditingBanner(banner);
    setBannerFormData({
      type: 'banner',
      title: banner.title,
      content: banner.content || '',
      image_url: banner.image_url || '',
      link_url: banner.link_url || '',
      is_active: banner.is_active ?? true
    });
    setIsModalOpen(true);
  };

  const handleAddNewBanner = () => {
    setEditingBanner(null);
    setBannerFormData({
      type: 'banner',
      title: '',
      content: '',
      image_url: '',
      link_url: '',
      is_active: true
    });
    setIsModalOpen(true);
  };

  const handleBannerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const loadingToast = toast.loading(editingBanner ? 'Updating Banner...' : 'Deploying Banner...');
    try {
      if (editingBanner) {
        await updateCMSContent(editingBanner.id, bannerFormData);
        toast.success('Banner updated', { id: loadingToast });
      } else {
        await createCMSContent(bannerFormData);
        toast.success('Banner deployed', { id: loadingToast });
      }
      setIsModalOpen(false);
      onUpdate();
    } catch (error) {
      toast.error('Operation failed', { id: loadingToast });
    }
  };

  const handleDeleteBanner = async (id: string) => {
    if (!confirm('Are you sure you want to decommission this banner?')) return;
    const loadingToast = toast.loading('Decommissioning Banner...');
    try {
      await deleteRecord('cms_content', id);
      toast.success('Banner decommissioned', { id: loadingToast });
      onUpdate();
    } catch (error) {
      toast.error('Failed to decommission', { id: loadingToast });
    }
  };

  return (
    <div className="space-y-12">
      <div>
        <h1 className="text-4xl font-black tracking-tighter uppercase mb-2">Hero Experience</h1>
        <p className="text-slate-500 font-medium">Primary landing page narrative and imagery</p>
      </div>

      <div className="grid lg:grid-cols-2 gap-8">
        <form onSubmit={handleHeroSubmit} className="bg-white p-10 rounded-[40px] border border-slate-100 shadow-sm space-y-8">
          <div className="space-y-6">
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Headline</label>
              <input 
                type="text" 
                value={heroFormData.hero_headline}
                onChange={(e) => setHeroFormData({...heroFormData, hero_headline: e.target.value})}
                className="w-full px-6 py-4 bg-slate-50 rounded-2xl border-none outline-none focus:ring-2 focus:ring-primary/20 font-bold transition-all text-xl" 
              />
            </div>
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Sub-Narrative</label>
              <textarea 
                value={heroFormData.hero_subtext}
                onChange={(e) => setHeroFormData({...heroFormData, hero_subtext: e.target.value})}
                className="w-full px-6 py-4 bg-slate-50 rounded-2xl border-none outline-none focus:ring-2 focus:ring-primary/20 font-bold transition-all h-32 resize-none" 
              />
            </div>
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Book Imagery (Hero)</label>
              <input 
                type="file" 
                accept="image/*"
                onChange={handleHeroUpload}
                className="hidden" 
                id="hero-upload"
              />
              <label 
                htmlFor="hero-upload"
                className="flex items-center justify-center gap-2 w-full px-6 py-4 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200 hover:border-primary/50 hover:bg-primary/5 cursor-pointer transition-all font-bold text-sm text-slate-500"
              >
                <ImageIcon className="w-5 h-5" />
                {isUploadingHero ? 'Uploading Hero Imagery...' : 'Change Hero Narrative Imagery'}
              </label>
            </div>
          </div>
          <button 
            type="submit"
            className="w-full bg-primary text-white py-6 rounded-[32px] font-black uppercase tracking-widest shadow-2xl shadow-primary/30 hover:scale-[1.02] active:scale-[0.98] transition-all"
          >
            Synchronize Hero Section
          </button>
        </form>

        <div className="bg-white p-10 rounded-[40px] border border-slate-100 shadow-sm">
          <h3 className="text-xl font-black tracking-tighter uppercase mb-8">Real-time Preview</h3>
          <div className="relative rounded-[32px] overflow-hidden bg-slate-900 aspect-video group">
            <img 
              src={heroFormData.hero_image_url} 
              alt="Hero Preview" 
              className="w-full h-full object-cover opacity-60 group-hover:scale-110 transition-transform duration-1000" 
            />
            <div className="absolute inset-0 p-12 flex flex-col justify-center">
              <h2 className="text-3xl font-black text-white uppercase tracking-tighter mb-4 max-w-md">{heroFormData.hero_headline}</h2>
              <p className="text-white/80 text-sm font-bold max-w-sm mb-8">{heroFormData.hero_subtext}</p>
              <div className="flex gap-4">
                <div className="px-6 py-2 bg-white text-slate-900 rounded-full font-black text-xs uppercase tracking-widest">Shop</div>
                <div className="px-6 py-2 bg-white/20 text-white rounded-full font-black text-xs uppercase tracking-widest backdrop-blur-md">Club</div>
              </div>
            </div>
          </div>
          
          <div className="mt-12">
             <div className="flex justify-between items-center mb-8">
               <h3 className="text-xl font-black tracking-tighter uppercase">Promotional Banners</h3>
               <button 
                onClick={handleAddNewBanner}
                className="text-primary font-bold text-sm hover:underline flex items-center gap-1"
               >
                 <Plus className="w-4 h-4" />
                 Deploy New Visual Node
               </button>
             </div>

             <div className="space-y-4">
                {banners.map((banner: any) => (
                  <div key={banner.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center gap-4 group">
                    <div className="w-20 h-12 bg-slate-200 rounded-lg overflow-hidden">
                      <img src={banner.image_url} alt={banner.title} className="w-full h-full object-cover" />
                    </div>
                    <div className="flex-1">
                      <p className="font-black text-slate-900 text-sm uppercase tracking-tighter">{banner.title}</p>
                      <p className="text-[10px] text-slate-400 font-bold line-clamp-1">{banner.content}</p>
                    </div>
                    <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-all">
                      <button 
                        onClick={() => handleEditBanner(banner)}
                        className="p-2 bg-white text-slate-600 rounded-lg hover:bg-primary hover:text-white transition-all shadow-sm"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => handleDeleteBanner(banner.id)}
                        className="p-2 bg-white text-rose-500 rounded-lg hover:bg-rose-500 hover:text-white transition-all shadow-sm"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
                {banners.length === 0 && (
                  <div className="p-12 border-2 border-dashed border-slate-200 rounded-[32px] flex flex-col items-center justify-center text-center">
                    <ImageIcon className="w-12 h-12 text-slate-300 mb-4" />
                    <p className="font-black uppercase tracking-widest text-[10px] text-slate-400 mb-2">Secondary Campaign Visuals</p>
                    <button onClick={handleAddNewBanner} className="text-primary font-bold text-sm hover:underline">Deploy New Visual Node</button>
                  </div>
                )}
             </div>
          </div>
        </div>
      </div>

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
              className="relative bg-white w-full max-w-2xl rounded-[40px] shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
            >
              <div className="p-8 border-b border-slate-50 flex justify-between items-center bg-slate-50/50">
                <div>
                  <h2 className="text-2xl font-black uppercase tracking-tighter">{editingBanner ? 'Modify Banner' : 'Deploy Banner'}</h2>
                  <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Visual Campaign Protocol</p>
                </div>
                <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-white rounded-full transition-all">
                  <XCircle className="w-8 h-8 text-slate-300 hover:text-red-500" />
                </button>
              </div>

              <form onSubmit={handleBannerSubmit} className="flex-1 overflow-y-auto p-10 space-y-6 custom-scrollbar">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Banner Asset</label>
                  <div className="aspect-video bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200 overflow-hidden relative group">
                    {bannerFormData.image_url ? (
                      <>
                        <img src={bannerFormData.image_url} alt="Preview" className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center">
                          <label htmlFor="banner-upload" className="cursor-pointer bg-white text-slate-900 px-6 py-2 rounded-full font-black text-xs uppercase tracking-widest">Replace Asset</label>
                        </div>
                      </>
                    ) : (
                      <label htmlFor="banner-upload" className="absolute inset-0 flex flex-col items-center justify-center cursor-pointer hover:bg-slate-100 transition-all">
                        <ImageIcon className="w-12 h-12 text-slate-300 mb-2" />
                        <span className="font-bold text-xs text-slate-400 uppercase tracking-widest">Upload Campaign Asset</span>
                      </label>
                    )}
                    <input id="banner-upload" type="file" accept="image/*" onChange={handleBannerUpload} className="hidden" />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Banner Title</label>
                  <input 
                    required
                    type="text" 
                    value={bannerFormData.title}
                    onChange={(e) => setBannerFormData({...bannerFormData, title: e.target.value})}
                    placeholder="e.g. Summer Reading Challenge"
                    className="w-full px-6 py-4 bg-slate-50 rounded-2xl border-none outline-none focus:ring-2 focus:ring-primary/20 font-bold" 
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Banner Content</label>
                  <textarea 
                    required
                    value={bannerFormData.content}
                    onChange={(e) => setBannerFormData({...bannerFormData, content: e.target.value})}
                    placeholder="Brief description of the promotion"
                    className="w-full px-6 py-4 bg-slate-50 rounded-2xl border-none outline-none focus:ring-2 focus:ring-primary/20 font-bold h-32 resize-none" 
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Link URL (Optional)</label>
                  <input 
                    type="text" 
                    value={bannerFormData.link_url}
                    onChange={(e) => setBannerFormData({...bannerFormData, link_url: e.target.value})}
                    placeholder="https://..."
                    className="w-full px-6 py-4 bg-slate-50 rounded-2xl border-none outline-none focus:ring-2 focus:ring-primary/20 font-bold" 
                  />
                </div>

                <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-2xl">
                  <input 
                    type="checkbox" 
                    id="banner-active"
                    checked={bannerFormData.is_active}
                    onChange={(e) => setBannerFormData({...bannerFormData, is_active: e.target.checked})}
                    className="w-5 h-5 rounded border-slate-300 text-primary focus:ring-primary"
                  />
                  <label htmlFor="banner-active" className="text-sm font-bold text-slate-600">Active and visible to customers</label>
                </div>

                <button 
                  type="submit"
                  disabled={isUploadingBanner}
                  className="w-full bg-primary text-white py-6 rounded-[32px] font-black uppercase tracking-widest shadow-2xl shadow-primary/30 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50"
                >
                  {editingBanner ? 'Commit Changes' : 'Deploy Banner'}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ShippingView({ data, onUpdate }: any) {
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingZone, setEditingZone] = useState<any>(null);
  const [formData, setFormData] = useState({
    name: '',
    price: '',
    estimated_days: '3',
    country_code: 'KE',
    region: '',
    postal_codes: '',
    shipping_method: 'Standard',
    is_active: true
  });

  const filteredZones = useMemo(() => {
    return data.filter((zone: any) => 
      zone.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      zone.region?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      zone.country_code?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [data, searchTerm]);

  const handleEdit = (zone: any) => {
    setEditingZone(zone);
    setFormData({
      name: zone.name,
      price: (zone.price ?? zone.rate ?? zone.base_rate ?? 0).toString(),
      estimated_days: (zone.estimated_days ?? 3).toString(),
      country_code: zone.country_code || 'KE',
      region: zone.region || '',
      postal_codes: zone.postal_codes || '',
      shipping_method: zone.shipping_method || 'Standard',
      is_active: zone.is_active ?? true
    });
    setIsModalOpen(true);
  };

  const handleAddNew = () => {
    setEditingZone(null);
    setFormData({
      name: '',
      price: '',
      estimated_days: '3',
      country_code: 'KE',
      region: '',
      postal_codes: '',
      shipping_method: 'Standard',
      is_active: true
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const loadingToast = toast.loading(editingZone ? 'Updating Region...' : 'Registering Region...');
    try {
      const numericPrice = parseFloat(formData.price) || 0;
      const numericDays = parseInt(formData.estimated_days) || 3;

      // The database schema has been unified to use 'price' and 'estimated_days'
      // Sending 'rate' or 'base_rate' will cause failures if those columns were renamed.
      const payload = {
        name: formData.name,
        price: numericPrice,
        estimated_days: numericDays,
        country_code: formData.country_code,
        region: formData.region,
        postal_codes: formData.postal_codes,
        shipping_method: formData.shipping_method,
        is_active: formData.is_active
      };

      if (editingZone) {
        await updateRecord('shipping_zones', editingZone.id, payload);
        toast.success('Region updated', { id: loadingToast });
      } else {
        await createRecord('shipping_zones', payload);
        toast.success('Region registered', { id: loadingToast });
      }
      setIsModalOpen(false);
      onUpdate();
    } catch (error: any) {
      console.error('Shipping operation failed:', error);
      // Provide more specific feedback if it's a duplicate key error
      const message = error.message?.includes('duplicate key') 
        ? 'A region with this name already exists' 
        : (error.message || 'Operation failed');
      toast.error(message, { id: loadingToast });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to decommission this delivery region?')) return;
    const loadingToast = toast.loading('Decommissioning Region...');
    try {
      await deleteRecord('shipping_zones', id);
      toast.success('Region decommissioned', { id: loadingToast });
      onUpdate();
    } catch (error) {
      toast.error('Failed to decommission', { id: loadingToast });
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-4xl font-black tracking-tighter uppercase mb-2">Regional Management</h1>
          <p className="text-slate-500 font-medium">Geographic strategy and price floors</p>
        </div>
        <button 
          onClick={handleAddNew}
          className="bg-primary text-white px-8 py-4 rounded-2xl font-black uppercase tracking-tighter flex items-center gap-2 hover:opacity-90 transition-all shadow-xl shadow-primary/20"
        >
          <Plus className="w-5 h-5" />
          Add Delivery Region
        </button>
      </div>

      <div className="bg-white rounded-[40px] border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-8 border-b border-slate-50">
          <div className="relative max-w-md">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search regions or towns..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-6 py-4 bg-slate-50 rounded-2xl border-none outline-none focus:ring-2 focus:ring-primary/20 font-bold transition-all"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-slate-50/50">
                <th className="px-8 py-6 text-left text-[10px] font-black uppercase tracking-widest text-slate-400">Region/Town</th>
                <th className="px-8 py-6 text-left text-[10px] font-black uppercase tracking-widest text-slate-400">Country/Region</th>
                <th className="px-8 py-6 text-left text-[10px] font-black uppercase tracking-widest text-slate-400">Logistics Fee</th>
                <th className="px-8 py-6 text-left text-[10px] font-black uppercase tracking-widest text-slate-400">ETA</th>
                <th className="px-8 py-6 text-left text-[10px] font-black uppercase tracking-widest text-slate-400">Status</th>
                <th className="px-8 py-6 text-right text-[10px] font-black uppercase tracking-widest text-slate-400">Operations</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredZones.map((zone: any) => (
                <tr key={zone.id} className="hover:bg-slate-50/30 transition-all group">
                  <td className="px-8 py-6">
                    <p className="font-black text-slate-900 uppercase tracking-tighter">{zone.name}</p>
                    {zone.postal_codes && <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Codes: {zone.postal_codes}</p>}
                  </td>
                  <td className="px-8 py-6">
                    <div className="flex flex-col">
                      <span className="font-black text-slate-700 text-xs uppercase tracking-tighter">{zone.country_code || 'KE'}</span>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{zone.region || 'Standard'}</span>
                    </div>
                  </td>
                  <td className="px-8 py-6 font-black text-primary">KES {zone.price || zone.rate || zone.base_rate || 0}</td>
                  <td className="px-8 py-6 font-bold text-slate-500">{zone.estimated_days || 3} Days</td>
                  <td className="px-8 py-6">
                    <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter ${
                      zone.is_active ? 'bg-green-100 text-green-600' : 'bg-slate-100 text-slate-400'
                    }`}>
                      {zone.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-8 py-6 text-right">
                    <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all">
                      <button 
                        onClick={() => handleEdit(zone)}
                        className="p-2 bg-slate-50 text-slate-600 rounded-lg hover:bg-primary hover:text-white transition-all"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => handleDelete(zone.id)}
                        className="p-2 bg-slate-50 text-slate-600 rounded-lg hover:bg-red-500 hover:text-white transition-all"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredZones.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-8 py-20 text-center">
                    <Truck className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                    <p className="font-black uppercase tracking-widest text-slate-400">No matching regions found</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

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
              className="relative bg-white w-full max-w-2xl rounded-[40px] shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
            >
              <div className="p-8 border-b border-slate-50 flex justify-between items-center bg-slate-50/50">
                <div>
                  <h2 className="text-2xl font-black uppercase tracking-tighter">{editingZone ? 'Edit Region' : 'Add Region'}</h2>
                  <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Logistics Strategy Protocol</p>
                </div>
                <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-white rounded-full transition-all">
                  <XCircle className="w-8 h-8 text-slate-300 hover:text-red-500" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-10 space-y-8 custom-scrollbar">
                <div className="grid grid-cols-2 gap-6">
                  <div className="col-span-2">
                    <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Region/Town Name</label>
                    <input 
                      required
                      type="text" 
                      value={formData.name}
                      onChange={(e) => setFormData({...formData, name: e.target.value})}
                      placeholder="e.g. Nairobi CBD, Mombasa, Kisumu"
                      className="w-full px-6 py-4 bg-slate-50 rounded-2xl border-none outline-none focus:ring-2 focus:ring-primary/20 font-bold" 
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Country Code</label>
                    <input 
                      required
                      type="text" 
                      value={formData.country_code}
                      onChange={(e) => setFormData({...formData, country_code: e.target.value.toUpperCase()})}
                      placeholder="KE"
                      maxLength={2}
                      className="w-full px-6 py-4 bg-slate-50 rounded-2xl border-none outline-none focus:ring-2 focus:ring-primary/20 font-bold" 
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Region/Province</label>
                    <input 
                      type="text" 
                      value={formData.region}
                      onChange={(e) => setFormData({...formData, region: e.target.value})}
                      placeholder="e.g. Nairobi, Coast, Rift Valley"
                      className="w-full px-6 py-4 bg-slate-50 rounded-2xl border-none outline-none focus:ring-2 focus:ring-primary/20 font-bold" 
                    />
                  </div>

                  <div className="col-span-2">
                    <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Postal Codes (Comma separated)</label>
                    <input 
                      type="text" 
                      value={formData.postal_codes}
                      onChange={(e) => setFormData({...formData, postal_codes: e.target.value})}
                      placeholder="e.g. 00100, 00200 or 80100-80105"
                      className="w-full px-6 py-4 bg-slate-50 rounded-2xl border-none outline-none focus:ring-2 focus:ring-primary/20 font-bold" 
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Shipping Method</label>
                    <select 
                      value={formData.shipping_method}
                      onChange={(e) => setFormData({...formData, shipping_method: e.target.value})}
                      className="w-full px-6 py-4 bg-slate-50 rounded-2xl border-none outline-none focus:ring-2 focus:ring-primary/20 font-bold"
                    >
                      <option value="Standard">Standard Delivery</option>
                      <option value="Express">Express Delivery</option>
                      <option value="Pickup">Station Pickup</option>
                      <option value="Global">International</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Delivery Fee (KES)</label>
                    <input 
                      required
                      type="number" 
                      value={formData.price}
                      onChange={(e) => setFormData({...formData, price: e.target.value})}
                      placeholder="250"
                      className="w-full px-6 py-4 bg-slate-50 rounded-2xl border-none outline-none focus:ring-2 focus:ring-primary/20 font-bold" 
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Estimated Days</label>
                    <input 
                      required
                      type="number" 
                      value={formData.estimated_days}
                      onChange={(e) => setFormData({...formData, estimated_days: e.target.value})}
                      placeholder="3"
                      className="w-full px-6 py-4 bg-slate-50 rounded-2xl border-none outline-none focus:ring-2 focus:ring-primary/20 font-bold" 
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Regional Status</label>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, is_active: !formData.is_active })}
                      className={`w-full flex items-center justify-between px-6 py-4 rounded-2xl font-bold transition-all ${
                        formData.is_active 
                          ? 'bg-green-50 text-green-600 border-2 border-green-100' 
                          : 'bg-slate-50 text-slate-400 border-2 border-slate-100'
                      }`}
                    >
                      <span className="uppercase tracking-widest text-[10px]">{formData.is_active ? 'Active' : 'Inactive'}</span>
                      <div className={`w-10 h-5 rounded-full relative transition-all ${formData.is_active ? 'bg-green-500' : 'bg-slate-300'}`}>
                        <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${formData.is_active ? 'left-6' : 'left-1'}`} />
                      </div>
                    </button>
                  </div>
                </div>

                <button 
                  type="submit"
                  className="w-full bg-primary text-white py-6 rounded-[32px] font-black uppercase tracking-widest shadow-2xl shadow-primary/30 hover:scale-[1.02] active:scale-[0.98] transition-all mt-4"
                >
                  {editingZone ? 'Commit Changes' : 'Register Region'}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function AreasView({ data, onUpdate, formatPrice }: any) {
  const [searchTerm, setSearchTerm] = useState('');
  const [countyFilter, setCountyFilter] = useState('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingArea, setEditingArea] = useState<any>(null);
  const [formData, setFormData] = useState({
    name: '',
    price: '',
    weight_surcharge: '0',
    volume_surcharge: '0',
    estimated_days: '3',
    country_code: 'KE',
    region: '',
    county: '',
    postal_codes: '',
    shipping_method: 'Standard',
    valid_from: new Date().toISOString().split('T')[0],
    valid_until: '',
    is_active: true
  });

  const counties = useMemo(() => {
    const uniqueCounties = new Set<string>();
    data.forEach((item: any) => {
      if (item.county) uniqueCounties.add(item.county);
    });
    return Array.from(uniqueCounties).sort();
  }, [data]);

  const filteredData = useMemo(() => {
    return data.filter((area: any) => {
      const matchesSearch = 
        area.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        area.postal_codes?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCounty = countyFilter === 'all' || area.county === countyFilter;
      return matchesSearch && matchesCounty;
    });
  }, [data, searchTerm, countyFilter]);

  const handleAddNew = () => {
    setEditingArea(null);
    setFormData({
      name: '',
      price: '',
      weight_surcharge: '0',
      volume_surcharge: '0',
      estimated_days: '3',
      country_code: 'KE',
      region: '',
      county: '',
      postal_codes: '',
      shipping_method: 'Standard',
      valid_from: new Date().toISOString().split('T')[0],
      valid_until: '',
      is_active: true
    });
    setIsModalOpen(true);
  };

  const handleEdit = (area: any) => {
    setEditingArea(area);
    setFormData({
      name: area.name,
      price: (area.price || 0).toString(),
      weight_surcharge: (area.weight_surcharge || 0).toString(),
      volume_surcharge: (area.volume_surcharge || 0).toString(),
      estimated_days: (area.estimated_days || 3).toString(),
      country_code: area.country_code || 'KE',
      region: area.region || '',
      county: area.county || '',
      postal_codes: area.postal_codes || '',
      shipping_method: area.shipping_method || 'Standard',
      valid_from: area.valid_from ? new Date(area.valid_from).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
      valid_until: area.valid_until ? new Date(area.valid_until).toISOString().split('T')[0] : '',
      is_active: area.is_active ?? true
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const loadingToast = toast.loading(editingArea ? 'Updating area...' : 'Creating area...');
    try {
      const payload = {
        ...formData,
        price: parseFloat(formData.price),
        weight_surcharge: parseFloat(formData.weight_surcharge),
        volume_surcharge: parseFloat(formData.volume_surcharge),
        estimated_days: parseInt(formData.estimated_days),
        valid_from: formData.valid_from ? new Date(formData.valid_from).toISOString() : null,
        valid_until: formData.valid_until ? new Date(formData.valid_until).toISOString() : null
      };

      if (editingArea) {
        await updateRecord('shipping_zones', editingArea.id, payload);
        toast.success('Area updated successfully', { id: loadingToast });
      } else {
        await createRecord('shipping_zones', payload);
        toast.success('Area created successfully', { id: loadingToast });
      }
      setIsModalOpen(false);
      onUpdate();
    } catch (error) {
      toast.error('Failed to save area', { id: loadingToast });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this area?')) return;
    const loadingToast = toast.loading('Deleting area...');
    try {
      await deleteRecord('shipping_zones', id);
      toast.success('Area deleted', { id: loadingToast });
      onUpdate();
    } catch (error) {
      toast.error('Failed to delete area', { id: loadingToast });
    }
  };

  const handleExport = () => {
    const headers = ['Name', 'Price', 'Weight Surcharge', 'Volume Surcharge', 'County', 'Postal Codes', 'Method'];
    const csvContent = [
      headers.join(','),
      ...filteredData.map((area: any) => [
        `"${area.name}"`,
        area.price,
        area.weight_surcharge,
        area.volume_surcharge,
        `"${area.county}"`,
        `"${area.postal_codes}"`,
        area.shipping_method
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `shipping_areas_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Data exported successfully');
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target?.result as string;
      const lines = text.split('\n').filter(line => line.trim());
      const loadingToast = toast.loading(`Importing ${lines.length - 1} areas...`);
      
      try {
        // Skip header
        for (let i = 1; i < lines.length; i++) {
          const cols = lines[i].split(',').map(c => c.replace(/^"|"$/g, '').trim());
          if (cols.length >= 2) {
            await createRecord('shipping_zones', {
              name: cols[0],
              price: parseFloat(cols[1]) || 0,
              weight_surcharge: parseFloat(cols[2]) || 0,
              volume_surcharge: parseFloat(cols[3]) || 0,
              county: cols[4] || '',
              postal_codes: cols[5] || '',
              shipping_method: cols[6] || 'Standard',
              country_code: 'KE',
              is_active: true
            });
          }
        }
        toast.success('Import completed', { id: loadingToast });
        onUpdate();
      } catch (error) {
        toast.error('Import failed partially', { id: loadingToast });
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div>
          <h1 className="text-4xl font-black tracking-tighter uppercase mb-2">City/Area Management</h1>
          <p className="text-slate-500 font-medium">Manage Kenyan towns, counties and shipping surcharges</p>
        </div>
        
        <div className="flex flex-wrap gap-4 w-full md:w-auto">
          <label className="cursor-pointer bg-slate-900 text-white px-6 py-4 rounded-2xl font-black uppercase tracking-tighter flex items-center gap-2 hover:opacity-90 transition-all shadow-xl shadow-slate-900/10">
            <FileUp className="w-5 h-5" />
            Import CSV
            <input type="file" accept=".csv" onChange={handleImport} className="hidden" />
          </label>
          <button 
            onClick={handleExport}
            className="bg-slate-100 text-slate-900 px-6 py-4 rounded-2xl font-black uppercase tracking-tighter flex items-center gap-2 hover:bg-slate-200 transition-all"
          >
            <FileText className="w-5 h-5" />
            Export
          </button>
          <button 
            onClick={handleAddNew}
            className="bg-primary text-white px-8 py-4 rounded-2xl font-black uppercase tracking-tighter flex items-center gap-2 hover:opacity-90 transition-all shadow-xl shadow-primary/20"
          >
            <Plus className="w-5 h-5" />
            Add New Area
          </button>
        </div>
      </div>

      <div className="bg-white rounded-[40px] border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-8 border-b border-slate-50 flex flex-col md:flex-row gap-6">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search by town name or postal code..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-6 py-4 bg-slate-50 rounded-2xl border-none outline-none focus:ring-2 focus:ring-primary/20 font-bold transition-all"
            />
          </div>
          <select 
            value={countyFilter}
            onChange={(e) => setCountyFilter(e.target.value)}
            className="px-6 py-4 bg-slate-50 rounded-2xl border-none outline-none focus:ring-2 focus:ring-primary/20 font-bold transition-all min-w-[200px]"
          >
            <option value="all">All Counties</option>
            {counties.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-slate-50/50">
                <th className="px-8 py-6 text-left text-[10px] font-black uppercase tracking-widest text-slate-400">Town / County</th>
                <th className="px-8 py-6 text-left text-[10px] font-black uppercase tracking-widest text-slate-400">Base Price</th>
                <th className="px-8 py-6 text-left text-[10px] font-black uppercase tracking-widest text-slate-400">Surcharges (W/V)</th>
                <th className="px-8 py-6 text-left text-[10px] font-black uppercase tracking-widest text-slate-400">Validity</th>
                <th className="px-8 py-6 text-left text-[10px] font-black uppercase tracking-widest text-slate-400">Status</th>
                <th className="px-8 py-6 text-right text-[10px] font-black uppercase tracking-widest text-slate-400">Operations</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredData.map((area: any) => (
                <tr key={area.id} className="hover:bg-slate-50/30 transition-all group">
                  <td className="px-8 py-6">
                    <p className="font-black text-slate-900 uppercase tracking-tighter">{area.name}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{area.county || 'No County'}</span>
                      <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
                      <span className="text-[10px] font-bold text-primary uppercase tracking-widest">{area.postal_codes || 'N/A'}</span>
                    </div>
                  </td>
                  <td className="px-8 py-6">
                    <span className="font-black text-slate-900">{formatPrice(area.price)}</span>
                  </td>
                  <td className="px-8 py-6">
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] font-bold text-slate-500">Weight: +{formatPrice(area.weight_surcharge || 0)}/kg</span>
                      <span className="text-[10px] font-bold text-slate-500">Volume: +{formatPrice(area.volume_surcharge || 0)}/m³</span>
                    </div>
                  </td>
                  <td className="px-8 py-6">
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">From: {new Date(area.valid_from).toLocaleDateString()}</span>
                      {area.valid_until && (
                        <span className="text-[10px] font-bold text-orange-400 uppercase tracking-widest">Until: {new Date(area.valid_until).toLocaleDateString()}</span>
                      )}
                    </div>
                  </td>
                  <td className="px-8 py-6">
                    <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter ${
                      area.is_active ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'
                    }`}>
                      {area.is_active ? 'Active' : 'Deactivated'}
                    </span>
                  </td>
                  <td className="px-8 py-6 text-right">
                    <div className="flex justify-end gap-2">
                      <button 
                        onClick={() => handleEdit(area)}
                        className="p-2 bg-slate-50 text-slate-400 rounded-lg hover:bg-primary/10 hover:text-primary transition-all"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => handleDelete(area.id)}
                        className="p-2 bg-slate-50 text-slate-400 rounded-lg hover:bg-red-50 hover:text-red-500 transition-all"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-2xl bg-white rounded-[40px] shadow-2xl overflow-hidden"
            >
              <div className="p-10 border-b border-slate-50">
                <h2 className="text-3xl font-black tracking-tighter uppercase">{editingArea ? 'Edit Area Strategy' : 'New Area Protocol'}</h2>
                <p className="text-slate-500 font-medium">Configure logistics parameters for this geographic node</p>
              </div>

              <form onSubmit={handleSubmit} className="p-10 max-h-[70vh] overflow-y-auto custom-scrollbar">
                <div className="grid grid-cols-2 gap-6">
                  <div className="col-span-2">
                    <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Town/Area Name</label>
                    <input 
                      required
                      type="text" 
                      value={formData.name}
                      onChange={(e) => setFormData({...formData, name: e.target.value})}
                      placeholder="e.g. Nairobi Central"
                      className="w-full px-6 py-4 bg-slate-50 rounded-2xl border-none outline-none focus:ring-2 focus:ring-primary/20 font-bold" 
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">County</label>
                    <input 
                      type="text" 
                      value={formData.county}
                      onChange={(e) => setFormData({...formData, county: e.target.value})}
                      placeholder="e.g. Nairobi"
                      className="w-full px-6 py-4 bg-slate-50 rounded-2xl border-none outline-none focus:ring-2 focus:ring-primary/20 font-bold" 
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Postal Codes</label>
                    <input 
                      type="text" 
                      value={formData.postal_codes}
                      onChange={(e) => setFormData({...formData, postal_codes: e.target.value})}
                      placeholder="e.g. 00100"
                      className="w-full px-6 py-4 bg-slate-50 rounded-2xl border-none outline-none focus:ring-2 focus:ring-primary/20 font-bold" 
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Base Delivery Fee (KES)</label>
                    <input 
                      required
                      type="number" 
                      min="0"
                      value={formData.price}
                      onChange={(e) => setFormData({...formData, price: e.target.value})}
                      placeholder="0.00"
                      className="w-full px-6 py-4 bg-slate-50 rounded-2xl border-none outline-none focus:ring-2 focus:ring-primary/20 font-bold" 
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Weight Surcharge (per KG)</label>
                    <input 
                      type="number" 
                      min="0"
                      value={formData.weight_surcharge}
                      onChange={(e) => setFormData({...formData, weight_surcharge: e.target.value})}
                      placeholder="0.00"
                      className="w-full px-6 py-4 bg-slate-50 rounded-2xl border-none outline-none focus:ring-2 focus:ring-primary/20 font-bold" 
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Volume Surcharge (per m³)</label>
                    <input 
                      type="number" 
                      min="0"
                      value={formData.volume_surcharge}
                      onChange={(e) => setFormData({...formData, volume_surcharge: e.target.value})}
                      placeholder="0.00"
                      className="w-full px-6 py-4 bg-slate-50 rounded-2xl border-none outline-none focus:ring-2 focus:ring-primary/20 font-bold" 
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Valid From</label>
                    <input 
                      type="date" 
                      value={formData.valid_from}
                      onChange={(e) => setFormData({...formData, valid_from: e.target.value})}
                      className="w-full px-6 py-4 bg-slate-50 rounded-2xl border-none outline-none focus:ring-2 focus:ring-primary/20 font-bold" 
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Valid Until (Optional)</label>
                    <input 
                      type="date" 
                      value={formData.valid_until}
                      onChange={(e) => setFormData({...formData, valid_until: e.target.value})}
                      className="w-full px-6 py-4 bg-slate-50 rounded-2xl border-none outline-none focus:ring-2 focus:ring-primary/20 font-bold" 
                    />
                  </div>

                  <div className="flex items-center gap-3">
                    <input 
                      type="checkbox" 
                      id="is_active_area"
                      checked={formData.is_active}
                      onChange={(e) => setFormData({...formData, is_active: e.target.checked})}
                      className="w-5 h-5 rounded-lg border-slate-200 text-primary focus:ring-primary"
                    />
                    <label htmlFor="is_active_area" className="text-sm font-bold text-slate-700">Active Strategy</label>
                  </div>
                </div>

                <div className="mt-10 flex gap-4">
                  <button 
                    type="submit"
                    className="flex-1 bg-primary text-white py-4 rounded-2xl font-black uppercase tracking-tighter hover:opacity-90 transition-all shadow-xl shadow-primary/20"
                  >
                    {editingArea ? 'Commit Strategy' : 'Initialize Protocol'}
                  </button>
                  <button 
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 bg-slate-100 text-slate-500 py-4 rounded-2xl font-black uppercase tracking-tighter hover:bg-slate-200 transition-all"
                  >
                    Abort
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

function InquiriesView({ data, onUpdate }: any) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [deptFilter, setDeptFilter] = useState('all');

  const departments = useMemo(() => {
    const depts = new Set<string>();
    data.forEach((inquiry: any) => {
      if (inquiry.subject?.includes('(')) {
        depts.add(inquiry.subject.split('(')[0].trim());
      }
    });
    return Array.from(depts);
  }, [data]);

  const filteredData = useMemo(() => {
    return data.filter((inquiry: any) => {
      const matchesSearch = 
        inquiry.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        inquiry.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        inquiry.subject?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        inquiry.message?.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesStatus = statusFilter === 'all' || inquiry.status === statusFilter;
      const matchesDept = deptFilter === 'all' || inquiry.subject?.includes(deptFilter);

      return matchesSearch && matchesStatus && matchesDept;
    });
  }, [data, searchTerm, statusFilter, deptFilter]);

  const handleUpdateStatus = async (id: string, status: string) => {
    const loadingToast = toast.loading(`Updating to ${status}...`);
    try {
      await updateRecord('contact_messages', id, { status });
      toast.success(`Inquiry marked as ${status}`, { id: loadingToast });
      onUpdate();
    } catch (error) {
      toast.error('Failed to update status', { id: loadingToast });
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div>
          <h1 className="text-4xl font-black tracking-tighter uppercase mb-2">Stakeholder Inquiries</h1>
          <p className="text-slate-500 font-medium">Global communication and support stream</p>
        </div>
        
        <div className="flex flex-wrap gap-4 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search inquiries..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-white border border-slate-100 rounded-xl outline-none focus:ring-2 focus:ring-primary/20 font-bold transition-all text-sm"
            />
          </div>
          <select 
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-3 bg-white border border-slate-100 rounded-xl outline-none focus:ring-2 focus:ring-primary/20 font-bold transition-all text-sm"
          >
            <option value="all">All Status</option>
            <option value="New">New</option>
            <option value="In Progress">In Progress</option>
            <option value="Resolved">Resolved</option>
          </select>
          <select 
            value={deptFilter}
            onChange={(e) => setDeptFilter(e.target.value)}
            className="px-4 py-3 bg-white border border-slate-100 rounded-xl outline-none focus:ring-2 focus:ring-primary/20 font-bold transition-all text-sm"
          >
            <option value="all">All Departments</option>
            {departments.map(dept => (
              <option key={dept} value={dept}>{dept}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid gap-6">
        {filteredData.map((inquiry: any) => (
          <motion.div 
            key={inquiry.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="bg-white p-8 rounded-[32px] border border-slate-100 shadow-sm hover:shadow-xl hover:shadow-slate-200/50 transition-all flex flex-col md:flex-row gap-8 relative overflow-hidden"
          >
            {/* Delay Badge */}
            {inquiry.status === 'New' && (new Date().getTime() - new Date(inquiry.created_at).getTime() > 2 * 24 * 60 * 60 * 1000) && (
              <div className="absolute top-0 right-0 px-6 py-2 bg-rose-500 text-white text-[10px] font-black uppercase tracking-widest rounded-bl-2xl animate-pulse">
                Old / Delayed Alert
              </div>
            )}

            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-3 mb-4">
                <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter ${
                  inquiry.status === 'New' ? 'bg-blue-100 text-blue-600' :
                  inquiry.status === 'In Progress' ? 'bg-orange-100 text-orange-600' :
                  'bg-green-100 text-green-600'
                }`}>
                  {inquiry.status}
                </span>
                <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter ${
                  inquiry.priority === 'High' ? 'bg-red-100 text-red-600' :
                  inquiry.priority === 'Medium' ? 'bg-blue-100 text-blue-600' :
                  'bg-slate-100 text-slate-600'
                }`}>
                  {inquiry.priority || 'Medium'} Priority
                </span>
                {inquiry.subject?.includes('(') && (
                  <span className="px-3 py-1 bg-slate-100 text-slate-600 rounded-full text-[10px] font-black uppercase tracking-tighter">
                    Department: {inquiry.subject.split('(')[0].trim()}
                  </span>
                )}
              </div>
              <h3 className="text-xl font-black text-slate-900 mb-2">{inquiry.subject}</h3>
              <p className="text-slate-600 font-medium mb-6 leading-relaxed">"{inquiry.message}"</p>
              <div className="flex items-center gap-6">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">From</p>
                  <p className="font-bold text-slate-900">{inquiry.full_name}</p>
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Email Node</p>
                  <p className="font-bold text-slate-900">{inquiry.email}</p>
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Temporal Stamp</p>
                  <p className="font-bold text-slate-900">{new Date(inquiry.created_at).toLocaleString()}</p>
                </div>
              </div>
            </div>
            <div className="flex md:flex-col justify-end gap-3">
              <a 
                href={`mailto:${inquiry.email}?subject=Re: ${inquiry.subject}`}
                onClick={() => handleUpdateStatus(inquiry.id, 'In Progress')}
                className="bg-primary text-white px-8 py-3 rounded-2xl font-black uppercase tracking-tighter hover:opacity-90 transition-all text-center flex items-center justify-center"
              >
                Respond
              </a>
              {inquiry.status !== 'Resolved' && (
                <button 
                  onClick={() => handleUpdateStatus(inquiry.id, 'Resolved')}
                  className="bg-slate-50 text-slate-600 px-8 py-3 rounded-2xl font-black uppercase tracking-tighter hover:bg-slate-100 transition-all"
                >
                  Mark Resolved
                </button>
              )}
            </div>
          </motion.div>
        ))}
        {filteredData.length === 0 && (
          <div className="p-20 text-center bg-white rounded-[40px] border border-slate-100">
            <MessageSquare className="w-16 h-16 text-slate-200 mx-auto mb-4" />
            <p className="font-black uppercase tracking-widest text-slate-400">
              {data.length === 0 ? 'No active inquiries in stream' : 'No inquiries match your filters'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function ClubsView({ data, onUpdate }: any) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingClub, setEditingClub] = useState<any>(null);
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    image_url: '',
    is_active: true,
    membership_price: 0,
    metadata: {
      category: 'General',
      member_limit: 100,
      meeting_frequency: 'Monthly'
    }
  });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const loadingToast = toast.loading('Uploading community asset...');
    try {
      const url = await uploadSiteAsset(file);
      setFormData(prev => ({ ...prev, image_url: url }));
      toast.success('Asset synchronized', { id: loadingToast });
    } catch (error) {
      toast.error('Upload failed', { id: loadingToast });
    }
  };

  const handleEdit = (club: any) => {
    setEditingClub(club);
    setFormData({
      title: club.title,
      content: club.content || '',
      image_url: club.image_url || '',
      is_active: club.is_active ?? true,
      membership_price: club.membership_price || 0,
      metadata: {
        category: club.metadata?.category || 'General',
        member_limit: club.metadata?.member_limit || 100,
        meeting_frequency: club.metadata?.meeting_frequency || 'Monthly'
      }
    });
    setIsModalOpen(true);
  };

  const handleAddNew = () => {
    setEditingClub(null);
    setFormData({
      title: '',
      content: '',
      image_url: '',
      is_active: true,
      membership_price: 0,
      metadata: {
        category: 'General',
        member_limit: 100,
        meeting_frequency: 'Monthly'
      }
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const loadingToast = toast.loading(editingClub ? 'Updating Club...' : 'Initializing Club...');
    try {
      const payload = {
        ...formData,
        type: 'book_club'
      };

      if (editingClub) {
        await updateCMSContent(editingClub.id, payload);
        toast.success('Club updated', { id: loadingToast });
      } else {
        await createCMSContent(payload);
        toast.success('Club initialized', { id: loadingToast });
      }
      setIsModalOpen(false);
      onUpdate();
    } catch (error) {
      toast.error('Operation failed', { id: loadingToast });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to decommission this book club?')) return;
    const loadingToast = toast.loading('Decommissioning Club...');
    try {
      await deleteRecord('cms_content', id);
      toast.success('Club decommissioned', { id: loadingToast });
      onUpdate();
    } catch (error) {
      toast.error('Failed to decommission', { id: loadingToast });
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-4xl font-black tracking-tighter uppercase mb-2">Book Club Hub</h1>
          <p className="text-slate-500 font-medium">Manage literary communities and memberships</p>
        </div>
        <button 
          onClick={handleAddNew}
          className="bg-primary text-white px-8 py-4 rounded-2xl font-black uppercase tracking-tighter flex items-center gap-2 hover:opacity-90 transition-all shadow-xl shadow-primary/20"
        >
          <Plus className="w-5 h-5" />
          Initialize New Club
        </button>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {data.map((club: any) => (
          <motion.div 
            key={club.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white p-8 rounded-[40px] border border-slate-100 shadow-sm hover:shadow-xl hover:shadow-slate-200/50 transition-all group"
          >
            <div className="relative w-full h-48 bg-slate-50 rounded-[32px] mb-6 overflow-hidden">
              {club.image_url ? (
                <img src={club.image_url} alt={club.title} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-slate-200">
                  <Users className="w-12 h-12" />
                </div>
              )}
              <div className="absolute top-4 right-4">
                <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter ${
                  club.is_active ? 'bg-green-100 text-green-600' : 'bg-slate-100 text-slate-400'
                }`}>
                  {club.is_active ? 'Active' : 'Archived'}
                </span>
              </div>
            </div>
            
            <h3 className="text-xl font-black tracking-tighter uppercase mb-2 line-clamp-1">{club.title}</h3>
            <p className="text-sm text-slate-500 font-medium mb-6 line-clamp-2 leading-relaxed">{club.content}</p>
            
            <div className="flex items-center justify-between pt-4 border-t border-slate-50">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-primary" />
                <span className="font-black text-slate-900 text-sm">
                  {club.metadata?.member_limit || 0} Capacity
                </span>
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={() => handleEdit(club)}
                  className="p-2 bg-slate-50 text-slate-600 rounded-lg hover:bg-primary hover:text-white transition-all"
                >
                  <Edit className="w-4 h-4" />
                </button>
                <button 
                  onClick={() => handleDelete(club.id)}
                  className="p-2 bg-slate-50 text-slate-600 rounded-lg hover:bg-red-500 hover:text-white transition-all"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </motion.div>
        ))}

        {data.length === 0 && (
          <div className="col-span-full bg-white rounded-[40px] border border-slate-100 shadow-sm overflow-hidden p-12 text-center">
            <Users className="w-16 h-16 text-slate-200 mx-auto mb-4" />
            <p className="font-black uppercase tracking-widest text-slate-400">No active book clubs</p>
          </div>
        )}
      </div>

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
              className="relative bg-white w-full max-w-2xl rounded-[40px] shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
            >
              <div className="p-8 border-b border-slate-50 flex justify-between items-center bg-slate-50/50">
                <div>
                  <h2 className="text-2xl font-black uppercase tracking-tighter">{editingClub ? 'Modify Club' : 'Initialize Club'}</h2>
                  <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Community Architecture Protocol</p>
                </div>
                <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-white rounded-full transition-all">
                  <XCircle className="w-8 h-8 text-slate-300 hover:text-red-500" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-10 space-y-6 custom-scrollbar">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Club Imagery</label>
                  <div className="aspect-video bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200 overflow-hidden relative group">
                    {formData.image_url ? (
                      <>
                        <img src={formData.image_url} alt="Preview" className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center">
                          <label htmlFor="club-upload" className="cursor-pointer bg-white text-slate-900 px-6 py-2 rounded-full font-black text-xs uppercase tracking-widest">Replace Asset</label>
                        </div>
                      </>
                    ) : (
                      <label htmlFor="club-upload" className="absolute inset-0 flex flex-col items-center justify-center cursor-pointer hover:bg-slate-100 transition-all">
                        <ImageIcon className="w-12 h-12 text-slate-300 mb-2" />
                        <span className="font-bold text-xs text-slate-400 uppercase tracking-widest">Upload Community Asset</span>
                      </label>
                    )}
                    <input id="club-upload" type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Club Title</label>
                  <input 
                    required
                    type="text" 
                    value={formData.title}
                    onChange={(e) => setFormData({...formData, title: e.target.value})}
                    placeholder="e.g. Nairobi Sci-Fi Enthusiasts"
                    className="w-full px-6 py-4 bg-slate-50 rounded-2xl border-none outline-none focus:ring-2 focus:ring-primary/20 font-bold" 
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Club Vision / Description</label>
                  <textarea 
                    required
                    value={formData.content}
                    onChange={(e) => setFormData({...formData, content: e.target.value})}
                    placeholder="What is this community about?"
                    className="w-full px-6 py-4 bg-slate-50 rounded-2xl border-none outline-none focus:ring-2 focus:ring-primary/20 font-bold h-32 resize-none" 
                  />
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Category</label>
                    <input 
                      required
                      type="text" 
                      value={formData.metadata.category}
                      onChange={(e) => setFormData({
                        ...formData, 
                        metadata: { ...formData.metadata, category: e.target.value }
                      })}
                      placeholder="e.g. Fiction, Business"
                      className="w-full px-6 py-4 bg-slate-50 rounded-2xl border-none outline-none focus:ring-2 focus:ring-primary/20 font-bold" 
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Member Limit</label>
                    <input 
                      required
                      type="number" 
                      value={formData.metadata.member_limit}
                      onChange={(e) => setFormData({
                        ...formData, 
                        metadata: { ...formData.metadata, member_limit: parseInt(e.target.value) }
                      })}
                      className="w-full px-6 py-4 bg-slate-50 rounded-2xl border-none outline-none focus:ring-2 focus:ring-primary/20 font-bold" 
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Price (KES)</label>
                    <input 
                      required
                      type="number" 
                      value={formData.membership_price}
                      onChange={(e) => setFormData({
                        ...formData, 
                        membership_price: parseFloat(e.target.value)
                      })}
                      className="w-full px-6 py-4 bg-slate-50 rounded-2xl border-none outline-none focus:ring-2 focus:ring-primary/20 font-bold" 
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Image URL (Optional)</label>
                  <input 
                    type="text" 
                    value={formData.image_url}
                    onChange={(e) => setFormData({...formData, image_url: e.target.value})}
                    placeholder="https://..."
                    className="w-full px-6 py-4 bg-slate-50 rounded-2xl border-none outline-none focus:ring-2 focus:ring-primary/20 font-bold" 
                  />
                </div>

                <button 
                  type="submit"
                  className="w-full bg-primary text-white py-6 rounded-[32px] font-black uppercase tracking-widest shadow-2xl shadow-primary/30 hover:scale-[1.02] active:scale-[0.98] transition-all"
                >
                  {editingClub ? 'Commit Changes' : 'Initialize Club'}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function EventsView({ data, onUpdate }: any) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isRSVPModalOpen, setIsRSVPModalOpen] = useState(false);
  const [selectedEventRSVPs, setSelectedEventRSVPs] = useState<any[]>([]);
  const [editingEvent, setEditingEvent] = useState<any>(null);
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    image_url: '',
    is_active: true,
    metadata: {
      date: '',
      time: '14:00',
      location: 'Virtual / ReadMart Hub',
      type: 'Workshop'
    }
  });

  const fetchRSVPs = async (eventId: string) => {
    const rsvps = await getEventRSVPs(eventId);
    setSelectedEventRSVPs(rsvps);
    setIsRSVPModalOpen(true);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const loadingToast = toast.loading('Uploading event asset...');
    try {
      const url = await uploadSiteAsset(file);
      setFormData(prev => ({ ...prev, image_url: url }));
      toast.success('Asset synchronized', { id: loadingToast });
    } catch (error) {
      toast.error('Upload failed', { id: loadingToast });
    }
  };

  const handleEdit = (event: any) => {
    setEditingEvent(event);
    setFormData({
      title: event.title,
      content: event.content || '',
      image_url: event.image_url || '',
      is_active: event.is_active ?? true,
      metadata: {
        date: event.metadata?.date || '',
        time: event.metadata?.time || '14:00',
        location: event.metadata?.location || 'Virtual / ReadMart Hub',
        type: event.metadata?.type || 'Workshop'
      }
    });
    setIsModalOpen(true);
  };

  const handleAddNew = () => {
    setEditingEvent(null);
    setFormData({
      title: '',
      content: '',
      image_url: '',
      is_active: true,
      metadata: {
        date: '',
        time: '14:00',
        location: 'Virtual / ReadMart Hub',
        type: 'Workshop'
      }
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const loadingToast = toast.loading(editingEvent ? 'Updating Event...' : 'Deploying Event...');
    try {
      const payload = {
        ...formData,
        type: 'event'
      };

      if (editingEvent) {
        await updateCMSContent(editingEvent.id, payload);
        toast.success('Event updated', { id: loadingToast });
      } else {
        await createCMSContent(payload);
        toast.success('Event deployed', { id: loadingToast });
      }
      setIsModalOpen(false);
      onUpdate();
    } catch (error) {
      toast.error('Operation failed', { id: loadingToast });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to cancel this event?')) return;
    const loadingToast = toast.loading('Cancelling Event...');
    try {
      await deleteRecord('cms_content', id);
      toast.success('Event cancelled', { id: loadingToast });
      onUpdate();
    } catch (error) {
      toast.error('Failed to cancel', { id: loadingToast });
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-4xl font-black tracking-tighter uppercase mb-2">Event Coordination</h1>
          <p className="text-slate-500 font-medium">Monitor and deploy literary gatherings</p>
        </div>
        <button 
          onClick={handleAddNew}
          className="bg-primary text-white px-8 py-4 rounded-2xl font-black uppercase tracking-tighter flex items-center gap-2 hover:opacity-90 transition-all shadow-xl shadow-primary/20"
        >
          <Plus className="w-5 h-5" />
          Schedule Event
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {data.map((event: any) => (
          <motion.div 
            key={event.id}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white p-6 rounded-[40px] border border-slate-100 shadow-sm hover:shadow-xl hover:shadow-slate-200/50 transition-all group"
          >
            <div className="relative w-full h-48 bg-slate-50 rounded-[32px] mb-6 overflow-hidden">
              {event.image_url ? (
                <img src={event.image_url} alt={event.title} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-slate-200">
                  <Calendar className="w-12 h-12" />
                </div>
              )}
              <div className="absolute top-4 right-4">
                <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter ${
                  event.is_active ? 'bg-green-100 text-green-600' : 'bg-slate-100 text-slate-400'
                }`}>
                  {event.is_active ? 'Live' : 'Draft'}
                </span>
              </div>
            </div>
            
            <div className="space-y-4">
              <div>
                <h3 className="text-xl font-black tracking-tighter uppercase line-clamp-1">{event.title}</h3>
                <div className="flex items-center gap-2 text-primary font-bold text-xs mt-1">
                  <Clock className="w-3 h-3" />
                  {event.metadata?.date} @ {event.metadata?.time}
                </div>
              </div>

              <div className="flex items-center gap-2 text-slate-400 text-xs font-bold">
                <MapPin className="w-3 h-3" />
                {event.metadata?.location}
              </div>

              <div className="flex gap-2 pt-2">
                <button 
                  onClick={() => fetchRSVPs(event.id)}
                  className="w-12 h-12 flex items-center justify-center bg-primary/5 text-primary rounded-2xl hover:bg-primary/10 transition-all"
                  title="View RSVPs"
                >
                  <Users className="w-5 h-5" />
                </button>
                <button 
                  onClick={() => handleEdit(event)}
                  className="flex-1 bg-slate-50 text-slate-900 py-3 rounded-2xl font-black uppercase tracking-tighter text-xs hover:bg-slate-100 transition-all"
                >
                  Edit Event
                </button>
                <button 
                  onClick={() => handleDelete(event.id)}
                  className="w-12 h-12 flex items-center justify-center bg-slate-50 text-slate-400 rounded-2xl hover:bg-rose-50 hover:text-rose-500 transition-all"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            </div>
          </motion.div>
        ))}

        {data.length === 0 && (
          <div className="col-span-full bg-white rounded-[40px] border border-slate-100 shadow-sm overflow-hidden p-12 text-center">
            <Calendar className="w-16 h-16 text-slate-200 mx-auto mb-4" />
            <p className="font-black uppercase tracking-widest text-slate-400">No scheduled events</p>
          </div>
        )}
      </div>

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
              className="relative bg-white w-full max-w-2xl rounded-[40px] shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
            >
              <div className="p-8 border-b border-slate-50 flex justify-between items-center bg-slate-50/50">
                <div>
                  <h2 className="text-2xl font-black uppercase tracking-tighter">{editingEvent ? 'Modify Event' : 'Schedule Event'}</h2>
                  <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Literary Engagement Protocol</p>
                </div>
                <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-white rounded-full transition-all">
                  <XCircle className="w-8 h-8 text-slate-300 hover:text-red-500" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-10 space-y-6 custom-scrollbar">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Event Visual Asset</label>
                  <div className="aspect-video bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200 overflow-hidden relative group">
                    {formData.image_url ? (
                      <>
                        <img src={formData.image_url} alt="Preview" className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center">
                          <label htmlFor="event-upload" className="cursor-pointer bg-white text-slate-900 px-6 py-2 rounded-full font-black text-xs uppercase tracking-widest">Replace Asset</label>
                        </div>
                      </>
                    ) : (
                      <label htmlFor="event-upload" className="absolute inset-0 flex flex-col items-center justify-center cursor-pointer hover:bg-slate-100 transition-all">
                        <ImageIcon className="w-12 h-12 text-slate-300 mb-2" />
                        <span className="font-bold text-xs text-slate-400 uppercase tracking-widest">Upload Event Asset</span>
                      </label>
                    )}
                    <input id="event-upload" type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Event Title</label>
                  <input 
                    required
                    type="text" 
                    value={formData.title}
                    onChange={(e) => setFormData({...formData, title: e.target.value})}
                    placeholder="e.g. Writers Workshop 2026"
                    className="w-full px-6 py-4 bg-slate-50 rounded-2xl border-none outline-none focus:ring-2 focus:ring-primary/20 font-bold" 
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Event Description</label>
                  <textarea 
                    required
                    value={formData.content}
                    onChange={(e) => setFormData({...formData, content: e.target.value})}
                    placeholder="What's happening?"
                    className="w-full px-6 py-4 bg-slate-50 rounded-2xl border-none outline-none focus:ring-2 focus:ring-primary/20 font-bold h-32 resize-none" 
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Date</label>
                    <input 
                      required
                      type="date" 
                      value={formData.metadata.date}
                      onChange={(e) => setFormData({
                        ...formData, 
                        metadata: { ...formData.metadata, date: e.target.value }
                      })}
                      className="w-full px-6 py-4 bg-slate-50 rounded-2xl border-none outline-none focus:ring-2 focus:ring-primary/20 font-bold" 
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Time</label>
                    <input 
                      required
                      type="time" 
                      value={formData.metadata.time}
                      onChange={(e) => setFormData({
                        ...formData, 
                        metadata: { ...formData.metadata, time: e.target.value }
                      })}
                      className="w-full px-6 py-4 bg-slate-50 rounded-2xl border-none outline-none focus:ring-2 focus:ring-primary/20 font-bold" 
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Location / Platform</label>
                  <input 
                    required
                    type="text" 
                    value={formData.metadata.location}
                    onChange={(e) => setFormData({
                      ...formData, 
                      metadata: { ...formData.metadata, location: e.target.value }
                    })}
                    placeholder="e.g. Google Meet, ReadMart Hub"
                    className="w-full px-6 py-4 bg-slate-50 rounded-2xl border-none outline-none focus:ring-2 focus:ring-primary/20 font-bold" 
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Image URL (Optional)</label>
                  <input 
                    type="text" 
                    value={formData.image_url}
                    onChange={(e) => setFormData({...formData, image_url: e.target.value})}
                    placeholder="https://..."
                    className="w-full px-6 py-4 bg-slate-50 rounded-2xl border-none outline-none focus:ring-2 focus:ring-primary/20 font-bold" 
                  />
                </div>

                <button 
                  type="submit"
                  className="w-full bg-primary text-white py-6 rounded-[32px] font-black uppercase tracking-widest shadow-2xl shadow-primary/30 hover:scale-[1.02] active:scale-[0.98] transition-all"
                >
                  {editingEvent ? 'Commit Changes' : 'Deploy Event'}
                </button>
              </form>
            </motion.div>
          </div>
        )}

        {isRSVPModalOpen && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsRSVPModalOpen(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative bg-white w-full max-w-xl rounded-[40px] shadow-2xl overflow-hidden max-h-[80vh] flex flex-col"
            >
              <div className="p-8 border-b border-slate-50 flex justify-between items-center bg-slate-50/50">
                <div>
                  <h2 className="text-2xl font-black uppercase tracking-tighter">Event RSVPs</h2>
                  <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Attendance Protocol</p>
                </div>
                <button onClick={() => setIsRSVPModalOpen(false)} className="p-2 hover:bg-white rounded-full transition-all">
                  <XCircle className="w-8 h-8 text-slate-300 hover:text-red-500" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-8 space-y-4 custom-scrollbar">
                {selectedEventRSVPs.map((rsvp: any) => (
                  <div key={rsvp.id} className="flex items-center justify-between p-6 bg-slate-50 rounded-[32px] border border-slate-100">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary font-black">
                        {rsvp.profiles?.full_name?.[0] || 'U'}
                      </div>
                      <div>
                        <p className="font-black text-slate-900 uppercase tracking-tight">{rsvp.profiles?.full_name || 'User'}</p>
                        <p className="text-xs font-bold text-slate-400">{rsvp.profiles?.email}</p>
                      </div>
                    </div>
                    <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest ${
                      rsvp.status === 'attending' ? 'bg-green-100 text-green-600' : 
                      rsvp.status === 'interested' ? 'bg-blue-100 text-blue-600' : 
                      'bg-rose-100 text-rose-600'
                    }`}>
                      {rsvp.status}
                    </span>
                  </div>
                ))}

                {selectedEventRSVPs.length === 0 && (
                  <div className="py-20 text-center">
                    <Users className="w-16 h-16 text-slate-200 mx-auto mb-4" />
                    <p className="font-black uppercase tracking-widest text-slate-400">No RSVPs detected</p>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function AgreementsView({ partnerships, authors, onUpdate }: any) {
  const [selectedApp, setSelectedApp] = useState<any>(null);
  const [isUploading, setIsUploading] = useState(false);

  const handleStatusUpdate = async (table: string, id: string, status: string, name: string) => {
    const loadingToast = toast.loading(`Updating status for ${name}...`);
    try {
      // Use the applications API to ensure notifications are sent
      const type = table === 'author_applications' ? 'author' : 'partner';
      const response = await fetch('/api/applications', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, type, status })
      });

      if (!response.ok) throw new Error('API request failed');
      
      toast.success(`Status updated to ${status}`, { id: loadingToast });
      onUpdate();
      if (selectedApp && selectedApp.id === id) {
        setSelectedApp({ ...selectedApp, status });
      }
    } catch (error) {
      console.error('Status update error:', error);
      // Fallback to direct DB update if API fails (e.g. in dev without local API)
      try {
        await updateRecord(table, id, { status });
        toast.success(`Status updated (Direct DB)`, { id: loadingToast });
        onUpdate();
      } catch (dbError) {
        toast.error('Status update failed', { id: loadingToast });
      }
    }
  };

  const handleUploadAgreement = async (table: string, id: string, file: File, name: string, userId: string) => {
    setIsUploading(true);
    const loadingToast = toast.loading(`Uploading agreement for ${name}...`);
    try {
      const path = await uploadAgreementFile(file, `${id}_agreement`);
      
      // 1. Sync with the applications API
      const type = table === 'author_applications' ? 'author' : 'partner';
      const response = await fetch('/api/applications', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          id, 
          type, 
          status: 'agreement_sent',
          agreement_url: path
        })
      });

      if (!response.ok) throw new Error('API request failed');

      // 2. Create/Update record in the agreements table for the applicant's dashboard
      const { error: agreementError } = await supabase
        .from('agreements')
        .upsert({
          title: `${type === 'author' ? 'Author' : 'Partnership'} Collaboration Protocol`,
          description: `Terms and conditions for your ${type} collaboration with ReadMart.`,
          template_url: path,
          partner_id: userId,
          type: type as any,
          status: 'pending'
        }, { onConflict: 'partner_id, type' });

      if (agreementError) console.error('Agreement record sync failed:', agreementError);

      toast.success('Agreement issued and notification sent', { id: loadingToast });
      onUpdate();
      if (selectedApp && selectedApp.id === id) {
        setSelectedApp({ ...selectedApp, agreement_url: path, status: 'agreement_sent' });
      }
    } catch (error: any) {
      console.error('Agreement upload error:', error);
      // Fallback to direct DB update
      try {
        const path = await uploadAgreementFile(file, `${id}_agreement`);
        await updateRecord(table, id, { 
          agreement_url: path,
          status: 'agreement_sent'
        });
        
        // Try to sync agreement table even in fallback
        await supabase.from('agreements').upsert({
          title: `${table.includes('author') ? 'Author' : 'Partnership'} Collaboration Protocol`,
          template_url: path,
          partner_id: userId,
          type: table.includes('author') ? 'author' : 'partner' as any,
          status: 'pending'
        }, { onConflict: 'partner_id, type' });

        toast.success('Agreement uploaded (Direct DB)', { id: loadingToast });
        onUpdate();
      } catch (dbError) {
        toast.error(error.message || 'Upload failed', { id: loadingToast });
      }
    } finally {
      setIsUploading(false);
    }
  };

  const handleViewFile = async (path: string) => {
    if (!path) {
      toast.error('No document file found');
      return;
    }
    
    const { data, error } = await supabase.storage
      .from('partnership_documents')
      .createSignedUrl(path, 600); // 10 minutes

    if (error) {
      toast.error('Could not generate document link');
      return;
    }

    window.open(data.signedUrl, '_blank');
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-orange-50 text-orange-600 border-orange-100';
      case 'agreement_sent': return 'bg-blue-50 text-blue-600 border-blue-100';
      case 'agreement_confirming': return 'bg-indigo-50 text-indigo-600 border-indigo-100';
      case 'activating': return 'bg-purple-50 text-purple-600 border-purple-100';
      case 'completed': return 'bg-green-50 text-green-600 border-green-100';
      case 'rejected': return 'bg-red-50 text-red-600 border-red-100';
      default: return 'bg-slate-50 text-slate-600 border-slate-100';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'pending': return 'Pending Review';
      case 'agreement_sent': return 'Agreement Sent';
      case 'agreement_confirming': return 'Confirming Terms';
      case 'activating': return 'Activating Account';
      case 'completed': return 'Fully Activated';
      case 'rejected': return 'Rejected';
      default: return status;
    }
  };

  const ApplicationCard = ({ app, table, type }: any) => (
    <div className="p-6 bg-slate-50 rounded-[32px] border border-slate-100 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-black text-slate-900 text-lg">{app.company_name || app.organization || app.full_name}</p>
          <p className="text-xs font-bold text-slate-400">{app.email}</p>
        </div>
        <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${getStatusColor(app.status)}`}>
          {getStatusLabel(app.status)}
        </span>
      </div>

      <div className="flex gap-2">
        <button 
          onClick={() => setSelectedApp({ ...app, _table: table, _type: type })}
          className="flex-1 flex items-center justify-center gap-2 bg-white text-slate-900 py-3 rounded-xl font-bold text-xs hover:bg-slate-900 hover:text-white transition-all shadow-sm border border-slate-100"
        >
          <Eye className="w-4 h-4" />
          View Details
        </button>
        
        {app.status === 'pending' && (
          <label className={`flex-1 flex items-center justify-center gap-2 bg-primary text-white py-3 rounded-xl font-bold text-xs hover:opacity-90 transition-all shadow-lg shadow-primary/20 cursor-pointer ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}`}>
            {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileUp className="w-4 h-4" />}
            {isUploading ? 'Uploading...' : 'Upload Agreement'}
            <input 
              type="file" 
              className="hidden" 
              accept=".pdf,.docx" 
              disabled={isUploading}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleUploadAgreement(table, app.id, file, app.full_name, app.user_id);
              }}
            />
          </label>
        )}

        {app.status === 'agreement_confirming' && (
          <button 
            onClick={() => handleStatusUpdate(table, app.id, 'activating', app.full_name)}
            className="flex-1 flex items-center justify-center gap-2 bg-indigo-600 text-white py-3 rounded-xl font-bold text-xs hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-600/20"
          >
            <CheckCircle className="w-4 h-4" />
            Process Activation
          </button>
        )}

        {app.status === 'activating' && (
          <button 
            onClick={() => handleStatusUpdate(table, app.id, 'completed', app.full_name)}
            className="flex-1 flex items-center justify-center gap-2 bg-green-600 text-white py-3 rounded-xl font-bold text-xs hover:bg-green-700 transition-all shadow-lg shadow-green-600/20"
          >
            <Sparkles className="w-4 h-4" />
            Final Activation
          </button>
        )}
      </div>
    </div>
  );

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-black tracking-tighter uppercase mb-2">Protocol Agreements</h1>
        <p className="text-slate-500 font-medium">Verify and approve author and partner collaborations</p>
      </div>

      <div className="grid lg:grid-cols-2 gap-8">
        {/* Partnership Applications */}
        <div className="bg-white p-10 rounded-[40px] border border-slate-100 shadow-sm">
          <h3 className="text-xl font-black tracking-tighter uppercase mb-8 flex items-center gap-2">
            <Briefcase className="w-6 h-6 text-primary" />
            Partnership Applications
          </h3>
          <div className="space-y-4">
            {partnerships.map((app: any) => (
              <ApplicationCard key={app.id} app={app} table="partnership_applications" type="partner" />
            ))}
            {partnerships.length === 0 && (
              <p className="text-center py-8 text-slate-400 font-bold uppercase text-xs tracking-widest">No partnership protocols found</p>
            )}
          </div>
        </div>

        {/* Author Applications */}
        <div className="bg-white p-10 rounded-[40px] border border-slate-100 shadow-sm">
          <h3 className="text-xl font-black tracking-tighter uppercase mb-8 flex items-center gap-2">
            <Edit className="w-6 h-6 text-primary" />
            Author Applications
          </h3>
          <div className="space-y-4">
            {authors.map((app: any) => (
              <ApplicationCard key={app.id} app={app} table="author_applications" type="author" />
            ))}
            {authors.length === 0 && (
              <p className="text-center py-8 text-slate-400 font-bold uppercase text-xs tracking-widest">No author protocols found</p>
            )}
          </div>
        </div>
      </div>

      {/* Detail Modal */}
      <AnimatePresence>
        {selectedApp && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedApp(null)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative bg-white w-full max-w-2xl rounded-[40px] shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
            >
              <div className="p-8 border-b border-slate-50 flex justify-between items-center bg-slate-50/50">
                <div>
                  <h2 className="text-2xl font-black uppercase tracking-tighter">Application Details</h2>
                  <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">ID: {selectedApp.id.slice(0, 8)}...</p>
                </div>
                <button onClick={() => setSelectedApp(null)} className="p-2 hover:bg-white rounded-full transition-all">
                  <XCircle className="w-8 h-8 text-slate-300 hover:text-red-500" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-10 space-y-8 custom-scrollbar">
                <div className="grid grid-cols-2 gap-8">
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Full Name</label>
                    <p className="font-bold text-slate-900">{selectedApp.full_name}</p>
                  </div>
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Email Address</label>
                    <p className="font-bold text-slate-900">{selectedApp.email}</p>
                  </div>
                  {selectedApp.organization && (
                    <div>
                      <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Organization</label>
                      <p className="font-bold text-slate-900">{selectedApp.organization}</p>
                    </div>
                  )}
                  {selectedApp.service_type && (
                    <div>
                      <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Service Type</label>
                      <p className="font-bold text-slate-900">{selectedApp.service_type}</p>
                    </div>
                  )}
                  {selectedApp.contact_info && (
                    <div className="col-span-2">
                      <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Contact Info</label>
                      <p className="font-bold text-slate-900 bg-slate-50 p-4 rounded-xl">{selectedApp.contact_info}</p>
                    </div>
                  )}
                  {selectedApp.collaboration_intent && (
                    <div className="col-span-2">
                      <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Collaboration Intent</label>
                      <p className="font-bold text-slate-900 bg-slate-50 p-4 rounded-xl">{selectedApp.collaboration_intent}</p>
                    </div>
                  )}
                </div>

                <div className="space-y-4">
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400">Documents</label>
                  <div className="grid grid-cols-2 gap-4">
                    {selectedApp.proof_url && (
                      <button 
                        onClick={() => handleViewFile(selectedApp.proof_url)}
                        className="flex items-center gap-3 p-4 bg-slate-50 rounded-2xl hover:bg-slate-100 transition-all text-left"
                      >
                        <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm">
                          <Shield className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                          <p className="text-xs font-black uppercase tracking-tight">Qualification Proof</p>
                          <p className="text-[10px] font-bold text-slate-400">View Document</p>
                        </div>
                      </button>
                    )}
                    {selectedApp.agreement_url && (
                      <button 
                        onClick={() => handleViewFile(selectedApp.agreement_url)}
                        className="flex items-center gap-3 p-4 bg-blue-50 rounded-2xl hover:bg-blue-100 transition-all text-left"
                      >
                        <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm">
                          <FileText className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                          <p className="text-xs font-black uppercase tracking-tight text-blue-900">Agreement Draft</p>
                          <p className="text-[10px] font-bold text-blue-400">View Document</p>
                        </div>
                      </button>
                    )}
                    {selectedApp.signed_agreement_url && (
                      <button 
                        onClick={() => handleViewFile(selectedApp.signed_agreement_url)}
                        className="flex items-center gap-3 p-4 bg-green-50 rounded-2xl hover:bg-green-100 transition-all text-left"
                      >
                        <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm">
                          <CheckCircle className="w-5 h-5 text-green-600" />
                        </div>
                        <div>
                          <p className="text-xs font-black uppercase tracking-tight text-green-900">Signed Agreement</p>
                          <p className="text-[10px] font-bold text-green-400">View Document</p>
                        </div>
                      </button>
                    )}
                  </div>
                </div>

                <div className="pt-8 border-t border-slate-50 flex gap-4">
                  {selectedApp.status === 'pending' && (
                    <>
                      <button 
                        onClick={() => handleStatusUpdate(selectedApp._table, selectedApp.id, 'rejected', selectedApp.full_name)}
                        className="flex-1 bg-red-50 text-red-600 py-4 rounded-2xl font-black uppercase tracking-widest hover:bg-red-600 hover:text-white transition-all"
                      >
                        Reject Application
                      </button>
                      <label className="flex-[2] bg-primary text-white py-4 rounded-2xl font-black uppercase tracking-widest hover:opacity-90 transition-all flex items-center justify-center gap-2 cursor-pointer shadow-xl shadow-primary/20">
                        <FileUp className="w-5 h-5" />
                        Issue Agreement
                        <input 
                          type="file" 
                          className="hidden" 
                          accept=".pdf,.docx" 
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleUploadAgreement(selectedApp._table, selectedApp.id, file, selectedApp.full_name, selectedApp.user_id);
                          }}
                        />
                      </label>
                    </>
                  )}
                  {selectedApp.status === 'agreement_sent' && (
                    <div className="flex-1 text-center p-6 bg-blue-50 rounded-3xl border border-blue-100">
                      <Clock className="w-8 h-8 text-blue-600 mx-auto mb-2" />
                      <p className="text-sm font-bold text-blue-900">Waiting for Applicant Signature</p>
                      <p className="text-xs text-blue-400 mt-1">Status: {getStatusLabel(selectedApp.status)}</p>
                    </div>
                  )}
                  {(selectedApp.status === 'agreement_confirming' || selectedApp.status === 'activating') && (
                    <button 
                      onClick={() => handleStatusUpdate(selectedApp._table, selectedApp.id, selectedApp.status === 'agreement_confirming' ? 'activating' : 'completed', selectedApp.full_name)}
                      className="flex-1 bg-green-600 text-white py-4 rounded-2xl font-black uppercase tracking-widest hover:bg-green-700 transition-all shadow-xl shadow-green-600/20"
                    >
                      {selectedApp.status === 'agreement_confirming' ? 'Proceed to Activation' : 'Finalize Activation'}
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function PromosView({ data, onUpdate }: any) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPromo, setEditingPromo] = useState<any>(null);
  const [formData, setFormData] = useState({
    code: '',
    discount_type: 'percentage',
    discount_value: 0,
    min_order_amount: 0,
    usage_limit: 100,
    is_active: true,
    expires_at: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const loadingToast = toast.loading(editingPromo ? 'Updating Campaign...' : 'Deploying Campaign...');
    
    try {
      if (editingPromo) {
        await updateRecord('promos', editingPromo.id, formData);
      } else {
        await createRecord('promos', formData);
      }
      
      toast.success(editingPromo ? 'Campaign Modified' : 'Campaign Deployed', { id: loadingToast });
      setIsModalOpen(false);
      onUpdate();
    } catch (error) {
      toast.error('Campaign synchronization failed', { id: loadingToast });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to decommission this campaign permanently?')) return;
    const loadingToast = toast.loading('Decommissioning Campaign...');
    try {
      await deleteRecord('promos', id);
      toast.success('Campaign Decommissioned', { id: loadingToast });
      onUpdate();
    } catch (error) {
      toast.error('Decommission failed', { id: loadingToast });
    }
  };

  const openModal = (promo: any = null) => {
    if (promo) {
      setEditingPromo(promo);
      setFormData({
        code: promo.code,
        discount_type: promo.discount_type,
        discount_value: promo.discount_value,
        min_order_amount: promo.min_order_amount,
        usage_limit: promo.usage_limit,
        is_active: promo.is_active,
        expires_at: promo.expires_at ? new Date(promo.expires_at).toISOString().split('T')[0] : ''
      });
    } else {
      setEditingPromo(null);
      setFormData({
        code: '',
        discount_type: 'percentage',
        discount_value: 0,
        min_order_amount: 0,
        usage_limit: 100,
        is_active: true,
        expires_at: ''
      });
    }
    setIsModalOpen(true);
  };

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-4xl font-black tracking-tighter uppercase mb-2">Revenue Manipulation</h1>
          <p className="text-slate-500 font-medium">Growth hacking and campaign governance</p>
        </div>
        <button 
          onClick={() => openModal()}
          className="bg-primary text-white px-8 py-4 rounded-2xl font-black uppercase tracking-tighter flex items-center gap-2 hover:opacity-90 transition-all shadow-xl shadow-primary/20"
        >
          <Plus className="w-5 h-5" />
          Initialize Campaign
        </button>
      </div>

      <div className="bg-white rounded-[40px] border border-slate-100 shadow-sm overflow-hidden">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-slate-50/50">
              <th className="px-8 py-6 text-left text-[10px] font-black uppercase tracking-widest text-slate-400">Promo Signature</th>
              <th className="px-8 py-6 text-left text-[10px] font-black uppercase tracking-widest text-slate-400">Impact Value</th>
              <th className="px-8 py-6 text-left text-[10px] font-black uppercase tracking-widest text-slate-400">Utilization</th>
              <th className="px-8 py-6 text-left text-[10px] font-black uppercase tracking-widest text-slate-400">Temporal Limit</th>
              <th className="px-8 py-6 text-right text-[10px] font-black uppercase tracking-widest text-slate-400">Command</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {data.map((promo: any) => (
              <tr key={promo.id} className="hover:bg-slate-50/30 transition-all">
                <td className="px-8 py-6">
                  <span className="font-black text-slate-900 bg-slate-100 px-3 py-1 rounded-lg">{promo.code}</span>
                </td>
                <td className="px-8 py-6 font-black text-green-600">
                  {promo.discount_type === 'percentage' ? `${promo.discount_value}% OFF` : `KES ${promo.discount_value} OFF`}
                </td>
                <td className="px-8 py-6 font-bold text-slate-500">
                  {promo.usage_count} / {promo.usage_limit} Redemptions
                </td>
                <td className="px-8 py-6 font-bold text-slate-500">
                  {promo.expires_at ? new Date(promo.expires_at).toLocaleDateString() : 'Infinite'}
                </td>
                <td className="px-8 py-6 text-right">
                  <div className="flex justify-end gap-2">
                    <button 
                      onClick={() => openModal(promo)}
                      className="p-2 hover:bg-slate-100 rounded-xl transition-all text-slate-400 hover:text-primary"
                    >
                      <Edit className="w-5 h-5" />
                    </button>
                    <button 
                      onClick={() => handleDelete(promo.id)}
                      className="p-2 hover:bg-slate-100 rounded-xl transition-all text-slate-400 hover:text-red-500"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                    <button 
                      onClick={async () => {
                        const loadingToast = toast.loading(promo.is_active ? 'Decommissioning...' : 'Deploying...');
                        try {
                          await togglePromoStatus(promo.id, !promo.is_active);
                          toast.success(`Promo ${promo.is_active ? 'decommissioned' : 'deployed'}`, { id: loadingToast });
                          onUpdate();
                        } catch (error) {
                          toast.error('Operation failed', { id: loadingToast });
                        }
                      }}
                      className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                        promo.is_active ? 'bg-red-50 text-red-600 hover:bg-red-600 hover:text-white' : 'bg-green-50 text-green-600 hover:bg-green-600 hover:text-white'
                      }`}
                    >
                      {promo.is_active ? 'Decommission' : 'Deploy'}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

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
              className="relative bg-white w-full max-w-2xl rounded-[40px] shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
            >
              <div className="p-8 border-b border-slate-50 flex justify-between items-center bg-slate-50/50">
                <div>
                  <h2 className="text-2xl font-black uppercase tracking-tighter">{editingPromo ? 'Modify Campaign' : 'Initialize Campaign'}</h2>
                  <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Revenue Manipulation Protocol</p>
                </div>
                <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-white rounded-full transition-all">
                  <XCircle className="w-8 h-8 text-slate-300 hover:text-red-500" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-10 space-y-6 custom-scrollbar">
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Promo Signature (Code)</label>
                    <input 
                      required
                      type="text" 
                      value={formData.code}
                      onChange={(e) => setFormData({...formData, code: e.target.value.toUpperCase()})}
                      placeholder="e.g. READMART2026"
                      className="w-full px-6 py-4 bg-slate-50 rounded-2xl border-none outline-none focus:ring-2 focus:ring-primary/20 font-bold" 
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Impact Type</label>
                    <select 
                      value={formData.discount_type}
                      onChange={(e) => setFormData({...formData, discount_type: e.target.value})}
                      className="w-full px-6 py-4 bg-slate-50 rounded-2xl border-none outline-none focus:ring-2 focus:ring-primary/20 font-bold"
                    >
                      <option value="percentage">Percentage (%)</option>
                      <option value="fixed">Fixed Amount (KES)</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Impact Value</label>
                    <input 
                      required
                      type="number" 
                      value={formData.discount_value}
                      onChange={(e) => setFormData({...formData, discount_value: parseFloat(e.target.value)})}
                      className="w-full px-6 py-4 bg-slate-50 rounded-2xl border-none outline-none focus:ring-2 focus:ring-primary/20 font-bold" 
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Minimum Order Impact</label>
                    <input 
                      type="number" 
                      value={formData.min_order_amount}
                      onChange={(e) => setFormData({...formData, min_order_amount: parseFloat(e.target.value)})}
                      className="w-full px-6 py-4 bg-slate-50 rounded-2xl border-none outline-none focus:ring-2 focus:ring-primary/20 font-bold" 
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Utilization Limit</label>
                    <input 
                      required
                      type="number" 
                      value={formData.usage_limit}
                      onChange={(e) => setFormData({...formData, usage_limit: parseInt(e.target.value)})}
                      className="w-full px-6 py-4 bg-slate-50 rounded-2xl border-none outline-none focus:ring-2 focus:ring-primary/20 font-bold" 
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Temporal Limit (Expiry)</label>
                    <input 
                      type="date" 
                      value={formData.expires_at}
                      onChange={(e) => setFormData({...formData, expires_at: e.target.value})}
                      className="w-full px-6 py-4 bg-slate-50 rounded-2xl border-none outline-none focus:ring-2 focus:ring-primary/20 font-bold" 
                    />
                  </div>
                </div>

                <button 
                  type="submit"
                  className="w-full bg-primary text-white py-6 rounded-[32px] font-black uppercase tracking-widest shadow-2xl shadow-primary/30 hover:scale-[1.02] active:scale-[0.98] transition-all"
                >
                  {editingPromo ? 'Commit Changes' : 'Deploy Campaign'}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
