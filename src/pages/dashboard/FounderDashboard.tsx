import { motion } from 'framer-motion';
import { 
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  AreaChart, Area 
} from 'recharts';
import { 
  Users, ShoppingBag, DollarSign, Package, TrendingUp, 
  Shield, Image as ImageIcon, Plus, 
  Search, Filter, MoreVertical, Edit, Trash2,
  Truck, Tag, Calendar, MessageSquare,
  Handshake, Users2, Settings, RefreshCw, Eye, Power,
  ChevronDown, CheckCircle2, Upload, X, PenTool, Building2,
  AlertTriangle
} from 'lucide-react';
import { useState, useEffect, useMemo, useRef } from 'react';
import { useCurrency } from '@/contexts/CurrencyContext';
import { supabase } from '@/lib/supabase/client';
import { getAvailableBookClubs, getEvents } from '@/api/community';
import { 
  getGlobalAnalytics, 
  getInventory, 
  getOrders, 
  getAllUsers, 
  getCMSContent, 
  getShippingZones, 
  getPromos,
  getAuditLogs,
  getInquiries,
  getPartnerships,
  getTeamMembers,
  getSiteSettings,
  getCategories,
  deleteRecord,
  deleteRecords,
  createRecord,
  updateRecord,
  updateOrderStatus,
  togglePromoStatus,
  updateUserStatus,
  updateSiteSettings,
  updateCMSContent,
  createCMSContent,
  createProduct,
  updateProduct,
  bulkUpdateProducts
} from '@/api/dashboards';
import { uploadProductImage } from '@/api/storage';
import { toast } from 'sonner';

type DashboardTab = 
  | 'overview' 
  | 'products' 
  | 'orders' 
  | 'shipping' 
  | 'promos' 
  | 'banners' 
  | 'events' 
  | 'inquiries' 
  | 'partnerships' 
  | 'author-apps'
  | 'clubs' 
  | 'users' 
  | 'team' 
  | 'settings';

export default function FounderDashboard() {
  const [activeTab, setActiveTab] = useState<DashboardTab>('overview');
  const [inventorySearch, setInventorySearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState<string>('');
  const [modalData, setModalData] = useState<any>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkEditForm, setBulkEditForm] = useState({
    stock_quantity: '',
    price: '',
    category: ''
  });
  
  // Product Form State
  // Form States
   const [productForm, setProductForm] = useState({
     title: '',
     category: 'Hardcover',
     price: 0,
     stock_quantity: 0,
     description: '',
     image_url: '',
     sku: '',
     isbn: ''
   });

   const [promoForm, setPromoForm] = useState<{
     code: string;
     discount_type: string;
     discount_value: number;
     usage_limit: number;
     expires_at: string;
   }>({
     code: '',
     discount_type: 'percentage',
     discount_value: 0,
     usage_limit: 100,
     expires_at: ''
   });

   const [shippingForm, setShippingForm] = useState<{
     name: string;
     base_rate: number;
     description: string;
   }>({
     name: '',
     base_rate: 0,
     description: ''
   });

   const [teamForm, setTeamForm] = useState<{
     full_name: string;
     email: string;
     role: string;
     is_active: boolean;
   }>({
     full_name: '',
     email: '',
     role: 'manager',
     is_active: true
   });

   const [eventForm, setEventForm] = useState<{
     title: string;
     published_at: string;
     metadata: {
       location: string;
       registrations_count: number;
     }
   }>({
     title: '',
     published_at: '',
     metadata: {
       location: '',
       registrations_count: 0
     }
   });

   const [clubForm, setClubForm] = useState<{
     title: string;
     description: string;
     is_active: boolean;
     metadata: {
       members_count: number;
     }
   }>({
     title: '',
     description: '',
     is_active: true,
     metadata: {
       members_count: 0
     }
   });

   const [userForm, setUserForm] = useState<{
     email: string;
     role: string;
     full_name: string;
     is_active: boolean;
   }>({
     email: '',
     role: 'customer',
     full_name: '',
     is_active: true
   });

   const [bannerForm, setBannerForm] = useState<{
     title: string;
     content: string;
     image_url: string;
     type: string;
     is_active: boolean;
   }>({
     title: '',
     content: '',
     image_url: '',
     type: 'banner',
     is_active: true
   });
  
  // Data States
  const [clubs, setClubs] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [inventory, setInventory] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [cms, setCms] = useState<any[]>([]);
  const [hero, setHero] = useState<any>(null);
  const [shipping, setShipping] = useState<any[]>([]);
  const [promos, setPromos] = useState<any[]>([]);
  const [inquiries, setInquiries] = useState<any[]>([]);
  const [partnerships, setPartnerships] = useState<any[]>([]);
  const [authorApps, setAuthorApps] = useState<any[]>([]);
  const [team, setTeam] = useState<any[]>([]);
  const [settings, setSettings] = useState<any>(null);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [analytics, setAnalytics] = useState<any>(null);
  
  const [heroForm, setHeroForm] = useState<{
    title: string;
    content: string;
    image_url: string;
  }>({
    title: 'EVERY PAGE TELLS A STORY',
    content: 'Discover a curated sanctuary for bibliophiles and art enthusiasts. Bridging the gap between creators and readers.',
    image_url: 'https://images.unsplash.com/photo-1544947950-fa07a98d237f?q=80&w=1200'
  });

  const [isLoading, setIsLoading] = useState(false);
  const { formatPrice } = useCurrency();

  useEffect(() => {
    fetchTabData();
  }, [activeTab]);

  const fetchTabData = async () => {
    setIsLoading(true);
    try {
      switch (activeTab) {
        case 'overview':
          const [analyticsData, logs] = await Promise.all([
            getGlobalAnalytics(),
            getAuditLogs()
          ]);
          setAnalytics(analyticsData);
          setAuditLogs(logs);
          break;
        case 'products':
          const [inv, cats] = await Promise.all([
            getInventory(),
            getCategories()
          ]);
          setInventory(inv);
          setCategories(cats);
          break;
        case 'orders':
          setOrders(await getOrders());
          break;
        case 'users':
          setUsers(await getAllUsers());
          break;
        case 'banners':
          const cmsData = await getCMSContent();
          setCms(cmsData);
          const heroItem = cmsData.find(item => item.type === 'hero');
          setHero(heroItem || null);
          if (heroItem) {
            setHeroForm({
              title: heroItem.title,
              content: heroItem.content,
              image_url: heroItem.image_url
            });
          }
          break;
        case 'shipping':
          setShipping(await getShippingZones());
          break;
        case 'promos':
          setPromos(await getPromos());
          break;
        case 'clubs':
          setClubs(await getAvailableBookClubs());
          break;
        case 'events':
          setEvents(await getEvents());
          break;
        case 'inquiries':
          setInquiries(await getInquiries());
          break;
        case 'partnerships':
          setPartnerships(await getPartnerships());
          break;
        case 'author-apps':
          const { data: apps } = await supabase.from('author_applications').select('*').order('created_at', { ascending: false });
          setAuthorApps(apps || []);
          break;
        case 'team':
          setTeam(await getTeamMembers());
          break;
        case 'settings':
          setSettings(await getSiteSettings());
          break;
      }
    } catch (error: any) {
      console.error('Fetch error details:', {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code,
        fullError: error
      });
      toast.error(error.message || 'Failed to fetch dashboard data');
    } finally {
      setIsLoading(false);
    }
  };

  // Action Handlers
  const handleDelete = async (table: string, id: string) => {
    if (!confirm('Are you sure you want to delete this record? This action cannot be undone.')) return;
    
    try {
      await deleteRecord(table, id);
      toast.success('Record deleted successfully');
      fetchTabData(); // Refresh data
    } catch (error) {
      console.error('Delete error:', error);
      toast.error('Failed to delete record');
    }
  };

  const handleHeroSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      if (hero) {
        await updateCMSContent(hero.id, heroForm);
        toast.success('Hero section updated successfully');
      } else {
        await createCMSContent({
          type: 'hero',
          ...heroForm,
          is_active: true
        });
        toast.success('Hero section initialized successfully');
      }
      fetchTabData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to save hero section');
    } finally {
      setIsLoading(false);
    }
  };

  const handleProductSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      let imageUrl = productForm.image_url;

      // Handle file upload if a file is selected
      if (selectedFile) {
        toast.info('Uploading product image...');
        imageUrl = await uploadProductImage(selectedFile);
      }

      const slug = productForm.title
        .toLowerCase()
        .replace(/[^\w\s-]/g, '')
        .replace(/\s+/g, '-');

      const payload = {
        name: productForm.title,
        slug,
        description: productForm.description,
        price: Number(productForm.price),
        stock_quantity: Number(productForm.stock_quantity),
        category_id: productForm.category,
        metadata: {
          image_url: imageUrl,
          sku: productForm.sku,
          isbn: productForm.isbn,
          updated_at: new Date().toISOString()
        }
      };

      if (modalData) {
        await updateProduct(modalData.id, payload);
        toast.success('Product updated successfully');
      } else {
        await createProduct(payload);
        toast.success('Product created successfully');
      }
      setIsModalOpen(false);
      setSelectedFile(null);
      fetchTabData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to save product');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenericSave = async (table: string, formData: any) => {
    setIsLoading(true);
    try {
      if (modalData) {
        await updateRecord(table, modalData.id, formData);
        toast.success(`${table} updated successfully`);
      } else {
        await createRecord(table, formData);
        toast.success(`${table} created successfully`);
      }
      setIsModalOpen(false);
      fetchTabData();
    } catch (error: any) {
      toast.error(error.message || `Failed to save ${table}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleBulkUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedIds.length) return;

    setIsLoading(true);
    try {
      const updates: any = {};
      if (bulkEditForm.stock_quantity) updates.stock_quantity = Number(bulkEditForm.stock_quantity);
      if (bulkEditForm.price) updates.price = Number(bulkEditForm.price);
      if (bulkEditForm.category) updates.category_id = bulkEditForm.category;

      if (Object.keys(updates).length === 0) {
        toast.error('No changes specified for bulk update');
        return;
      }

      await bulkUpdateProducts(selectedIds, updates);
      toast.success(`Updated ${selectedIds.length} products`);
      setSelectedIds([]);
      setIsModalOpen(false);
      fetchTabData();
    } catch (error) {
      toast.error('Failed to bulk update products');
    } finally {
      setIsLoading(false);
    }
  };

  const handleBulkDelete = async (table: string) => {
    if (!selectedIds.length) return;
    if (!confirm(`Are you sure you want to delete ${selectedIds.length} items?`)) return;

    setIsLoading(true);
    try {
      await deleteRecords(table, selectedIds);
      toast.success('Items deleted successfully');
      setSelectedIds([]);
      fetchTabData();
    } catch (error) {
      toast.error('Failed to delete items');
    } finally {
      setIsLoading(false);
    }
  };

  const handleStatusUpdate = async (id: string, status: string) => {
    try {
      await updateOrderStatus(id, status);
      toast.success('Order status updated');
      fetchTabData();
    } catch (error) {
      toast.error('Failed to update order status');
    }
  };

  const handleTogglePromo = async (id: string, currentStatus: boolean) => {
    try {
      await togglePromoStatus(id, !currentStatus);
      toast.success(`Promo ${!currentStatus ? 'activated' : 'deactivated'}`);
      fetchTabData();
    } catch (error) {
      toast.error('Failed to toggle promo status');
    }
  };

  const handleUserStatusUpdate = async (id: string, currentStatus: boolean) => {
    try {
      await updateUserStatus(id, !currentStatus);
      toast.success(`User ${!currentStatus ? 'activated' : 'suspended'}`);
      fetchTabData();
    } catch (error) {
      toast.error('Failed to update user status');
    }
  };

  const handleInquiryStatusUpdate = async (id: string, status: string) => {
    try {
      await updateRecord('contact_messages', id, { status });
      toast.success(`Inquiry status updated to ${status}`);
      fetchTabData();
    } catch (error) {
      toast.error('Failed to update inquiry status');
    }
  };

  const handlePartnershipStatusUpdate = async (id: string, status: string) => {
    try {
      await updateRecord('partnership_applications', id, { status });
      toast.success(`Partnership status updated to ${status}`);
      fetchTabData();
    } catch (error) {
      toast.error('Failed to update partnership status');
    }
  };

  const handleAuthorStatusUpdate = async (id: string, status: string) => {
    try {
      await updateRecord('author_applications', id, { status });
      toast.success(`Author application status updated to ${status}`);
      fetchTabData();
    } catch (error) {
      toast.error('Failed to update author application status');
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await updateSiteSettings(settings);
      toast.success('Global settings updated successfully');
    } catch (error) {
      toast.error('Failed to save settings');
    }
  };

  const stats = useMemo(() => [
    { label: 'Total Revenue', value: formatPrice(analytics?.totalRevenue || 0), icon: <DollarSign className="w-6 h-6" />, trend: '+12.5%' },
    { label: 'Total Orders', value: analytics?.totalOrders?.toLocaleString() || '0', icon: <ShoppingBag className="w-6 h-6" />, trend: '+8.2%' },
    { label: 'Total Customers', value: analytics?.totalUsers?.toLocaleString() || '0', icon: <Users className="w-6 h-6" />, trend: '+15.1%' },
    { label: 'Active Products', value: analytics?.totalProducts?.toLocaleString() || '0', icon: <Package className="w-6 h-6" />, trend: '+2.4%' },
  ], [analytics, formatPrice]);

  const salesChartData = useMemo(() => {
    if (!analytics?.salesData) return [];
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const grouped = analytics.salesData.reduce((acc: any, curr: any) => {
      const day = days[new Date(curr.created_at).getDay()];
      acc[day] = (acc[day] || 0) + Number(curr.total_amount);
      return acc;
    }, {});
    return days.map(day => ({ name: day, sales: grouped[day] || 0 }));
  }, [analytics]);

  const tabs = [
    { id: 'overview', label: 'Overview', icon: <TrendingUp className="w-4 h-4" />, color: 'from-blue-500 to-indigo-500' },
    { id: 'products', label: 'Products', icon: <Package className="w-4 h-4" />, color: 'from-emerald-500 to-teal-500' },
    { id: 'orders', label: 'Orders', icon: <ShoppingBag className="w-4 h-4" />, color: 'from-amber-500 to-orange-500' },
    { id: 'shipping', label: 'Shipping', icon: <Truck className="w-4 h-4" />, color: 'from-cyan-500 to-blue-500' },
    { id: 'promos', label: 'Promos', icon: <Tag className="w-4 h-4" />, color: 'from-rose-500 to-pink-500' },
    { id: 'banners', label: 'Banners', icon: <ImageIcon className="w-4 h-4" />, color: 'from-purple-500 to-violet-500' },
    { id: 'events', label: 'Events', icon: <Calendar className="w-4 h-4" />, color: 'from-fuchsia-500 to-purple-500' },
    { id: 'inquiries', label: 'Inquiries', icon: <MessageSquare className="w-4 h-4" />, color: 'from-indigo-500 to-blue-500' },
    { id: 'partnerships', label: 'Partnerships', icon: <Handshake className="w-4 h-4" />, color: 'from-teal-500 to-emerald-500' },
    { id: 'author-apps', label: 'Authors', icon: <PenTool className="w-4 h-4" />, color: 'from-rose-500 to-pink-500' },
    { id: 'clubs', label: 'Clubs', icon: <Users2 className="w-4 h-4" />, color: 'from-orange-500 to-amber-500' },
    { id: 'users', label: 'Users', icon: <Users className="w-4 h-4" />, color: 'from-violet-500 to-purple-500' },
    { id: 'team', label: 'Team', icon: <Shield className="w-4 h-4" />, color: 'from-blue-600 to-indigo-600' },
    { id: 'settings', label: 'Settings', icon: <Settings className="w-4 h-4" />, color: 'from-slate-600 to-slate-800' },
  ];

  return (
    <div className="min-h-screen bg-white text-slate-900 selection:bg-primary/10">
      <div className="container mx-auto px-4 py-8 max-w-[1600px]">
        {/* Header */}
        <header className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-12 gap-8">
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
            <div className="flex items-center gap-4 mb-2">
              <div className="p-3 bg-primary/10 rounded-2xl">
                <Shield className="w-8 h-8 text-primary" />
              </div>
              <div>
                <h1 className="text-4xl font-black tracking-tight text-slate-900">
                  Founder Dashboard
                </h1>
                <p className="text-muted-foreground font-medium">Ultimate authority over the ReadMart ecosystem</p>
              </div>
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="flex gap-4">
            <button 
              onClick={() => fetchTabData()}
              className="glass p-4 rounded-2xl hover:bg-slate-100 transition-all group border-slate-200 bg-white"
              title="Refresh Data"
            >
              <RefreshCw className={`w-5 h-5 group-hover:rotate-180 transition-all duration-500 text-slate-600 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
            <div className="h-12 w-px bg-slate-200 self-center" />
            <div className="flex items-center gap-3 glass px-6 py-3 rounded-2xl border-slate-200 bg-white">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center font-black text-white">F</div>
              <div className="hidden sm:block">
                <p className="text-sm font-bold leading-none text-slate-900">Founder Admin</p>
                <p className="text-[10px] text-muted-foreground uppercase tracking-widest mt-1">Super User</p>
              </div>
            </div>
          </motion.div>
        </header>

        {/* Navigation Tabs */}
        <div className="lg:hidden mb-12">
          <div className="relative">
            <select 
              value={activeTab}
              onChange={(e) => setActiveTab(e.target.value as DashboardTab)}
              className="w-full bg-white border border-slate-200 rounded-2xl px-6 py-5 font-black outline-none appearance-none focus:ring-2 focus:ring-primary text-lg text-slate-900"
            >
              {tabs.map(tab => (
                <option key={tab.id} value={tab.id} className="bg-white text-slate-900">
                  {tab.label}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-6 top-1/2 -translate-y-1/2 w-6 h-6 text-primary pointer-events-none" />
          </div>
        </div>

        <nav className="hidden lg:flex gap-2 mb-12 overflow-x-auto pb-4 scrollbar-hide no-scrollbar">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as DashboardTab)}
              className={`flex items-center gap-3 px-6 py-4 rounded-2xl font-black whitespace-nowrap transition-all duration-300 relative group ${
                activeTab === tab.id 
                  ? 'text-white' 
                  : 'text-muted-foreground hover:text-slate-900 glass hover:bg-slate-100 border-slate-200 bg-white'
              }`}
            >
              {activeTab === tab.id && (
                <motion.div 
                  layoutId="activeTab"
                  className={`absolute inset-0 bg-gradient-to-r ${tab.color} rounded-2xl -z-10 shadow-lg shadow-primary/20`}
                />
              )}
              <span className={`${activeTab === tab.id ? 'scale-110' : 'group-hover:scale-110'} transition-transform`}>
                {tab.icon}
              </span>
              {tab.label}
            </button>
          ))}
        </nav>

        {/* Content Area */}
        <main className="space-y-8">
          {isLoading ? (
            <div className="min-h-[600px] flex flex-col items-center justify-center gap-4">
              <div className="relative">
                <div className="w-20 h-20 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
                <Shield className="w-8 h-8 text-primary absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
              </div>
              <p className="text-muted-foreground font-black animate-pulse uppercase tracking-widest">Synchronizing Intelligence...</p>
            </div>
          ) : (
            <>
              {activeTab === 'overview' && (
                <div className="space-y-12">
                  {analytics && !analytics.isInitialized && (
                    <motion.div 
                      initial={{ opacity: 0, y: -20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="glass p-6 rounded-[2rem] border-amber-200 bg-amber-50 flex items-center gap-6"
                    >
                      <div className="p-4 bg-amber-100 rounded-2xl">
                        <AlertTriangle className="w-8 h-8 text-amber-600" />
                      </div>
                      <div>
                        <h4 className="text-xl font-black text-amber-600">Database Initialization Pending</h4>
                        <p className="text-amber-900/70 font-medium">Some analytics tables (orders, reviews, etc.) haven't been created or populated yet. Statistics will update once data is available.</p>
                      </div>
                    </motion.div>
                  )}
                  {/* Stats Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    {stats.map((stat, i) => (
                      <motion.div
                        key={stat.label}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.1 }}
                        className="glass p-8 rounded-[2.5rem] relative overflow-hidden group border-slate-200 bg-white shadow-sm"
                      >
                        <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity text-slate-900">
                          {stat.icon}
                        </div>
                        <div className="flex justify-between items-start mb-6">
                          <div className="p-4 bg-primary/5 rounded-2xl text-primary">
                            {stat.icon}
                          </div>
                          <span className="text-green-600 text-sm font-black bg-green-50 px-3 py-1 rounded-full flex items-center gap-1">
                            <TrendingUp className="w-4 h-4" />
                            {stat.trend}
                          </span>
                        </div>
                        <p className="text-muted-foreground font-bold text-sm uppercase tracking-widest mb-1">{stat.label}</p>
                        <h3 className="text-4xl font-black text-slate-900">{stat.value}</h3>
                      </motion.div>
                    ))}
                  </div>

                  <div className="grid lg:grid-cols-3 gap-8">
                    {/* Revenue Chart */}
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="lg:col-span-2 glass p-10 rounded-[3rem] min-h-[500px] border-slate-200 bg-white shadow-sm"
                    >
                      <div className="flex justify-between items-center mb-10">
                        <div>
                          <h3 className="text-2xl font-black text-slate-900">Financial Intelligence</h3>
                          <p className="text-muted-foreground text-sm">Real-time revenue aggregation and trends</p>
                        </div>
                        <button className="glass px-6 py-3 rounded-2xl font-black text-xs hover:bg-primary hover:text-white transition-all border-slate-200 bg-white">
                          Reconcile Payments
                        </button>
                      </div>
                      <div className="h-[400px] w-full min-h-[400px] relative">
                        <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0} debounce={100}>
                          <AreaChart data={salesChartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                            <defs>
                              <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.3}/>
                                <stop offset="95%" stopColor="var(--primary)" stopOpacity={0}/>
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.05)" />
                            <XAxis dataKey="name" stroke="rgba(0,0,0,0.3)" fontSize={12} fontWeight="bold" />
                            <YAxis stroke="rgba(0,0,0,0.3)" fontSize={12} fontWeight="bold" />
                            <Tooltip 
                              contentStyle={{ background: 'rgba(255,255,255,0.95)', border: '1px solid rgba(0,0,0,0.1)', borderRadius: '24px', padding: '20px' }}
                              itemStyle={{ color: '#000', fontWeight: '900' }}
                            />
                            <Area type="monotone" dataKey="sales" stroke="var(--primary)" strokeWidth={4} fillOpacity={1} fill="url(#colorSales)" />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    </motion.div>

                    {/* Audit Logs */}
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.1 }}
                      className="glass p-10 rounded-[3rem] min-h-[500px] border-slate-200 bg-white shadow-sm"
                    >
                      <h3 className="text-2xl font-black mb-8 text-slate-900">Audit Authority</h3>
                      <div className="space-y-6">
                        {auditLogs.length > 0 ? (
                          auditLogs.slice(0, 6).map((log) => (
                            <div key={log.id} className="flex items-center gap-4 group">
                          <div className="w-12 h-12 rounded-2xl bg-white flex items-center justify-center text-primary group-hover:bg-primary/20 transition-all shrink-0">
                                <Shield className="w-5 h-5" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="font-black truncate text-slate-900">{log.action}</p>
                                <p className="text-xs text-muted-foreground">
                                  {new Date(log.created_at).toLocaleTimeString()} by {log.profiles?.full_name || 'System'}
                                </p>
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="h-full flex flex-col items-center justify-center text-center opacity-50 py-20">
                            <RefreshCw className="w-12 h-12 mb-4 animate-spin-slow text-slate-400" />
                            <p className="font-black uppercase tracking-widest text-slate-400">Waiting for Activity...</p>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  </div>
                </div>
              )}

              {activeTab === 'products' && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                    <div>
                      <h3 className="text-3xl font-black mb-2 text-slate-900">Inventory Engine</h3>
                      <p className="text-muted-foreground">Catalog Governance and Bulk Operations</p>
                    </div>
                    <div className="flex gap-4">
                      {selectedIds.length > 0 && (
                        <>
                          <button 
                            onClick={() => {
                              setModalType('bulk-product');
                              setBulkEditForm({ stock_quantity: '', price: '', category: '' });
                              setIsModalOpen(true);
                            }}
                            className="glass px-6 py-3 rounded-2xl font-black text-sm flex items-center gap-2 hover:bg-slate-100 transition-all border-slate-200 text-slate-900 bg-white"
                          >
                            <Edit className="w-4 h-4" /> Bulk Edit ({selectedIds.length})
                          </button>
                          <button 
                            onClick={() => handleBulkDelete('products')}
                            className="bg-red-500 text-white px-6 py-3 rounded-2xl font-black text-sm flex items-center gap-2 hover:bg-red-600 transition-all shadow-lg shadow-red-500/20"
                          >
                            <Trash2 className="w-4 h-4" /> Delete ({selectedIds.length})
                          </button>
                        </>
                      )}
                      <button 
                        onClick={() => toast.info('Auto-categorization engine starting...')}
                        className="glass px-6 py-3 rounded-2xl font-black text-sm flex items-center gap-2 hover:bg-slate-100 transition-all border-slate-200 text-slate-900 bg-white"
                      >
                        <RefreshCw className="w-4 h-4" /> Auto-Categorize
                      </button>
                      <button 
                        onClick={() => { 
                          setModalType('product'); 
                          setModalData(null);
                          setProductForm({
                            title: '',
                            category: 'Hardcover',
                            price: 0,
                            stock_quantity: 0,
                            description: '',
                            image_url: '',
                            sku: '',
                            isbn: ''
                          });
                          setIsModalOpen(true); 
                        }}
                        className="bg-primary text-white px-8 py-3 rounded-2xl font-black text-sm flex items-center gap-2 shadow-lg shadow-primary/20 hover:scale-105 transition-all"
                      >
                        <Plus className="w-5 h-5" /> Add Product
                      </button>
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <div className="relative flex-1 group">
                      <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
                      <input 
                        type="text" 
                        placeholder="Search by Title, SKU, or ISBN..." 
                        value={inventorySearch}
                        onChange={(e) => setInventorySearch(e.target.value)}
                        className="w-full pl-14 pr-6 py-5 glass rounded-[2rem] focus:ring-4 focus:ring-primary/20 outline-none transition-all font-bold border-slate-200 bg-white text-slate-900"
                      />
                    </div>
                    <button className="glass px-8 py-5 rounded-[2rem] flex items-center gap-3 font-black hover:bg-slate-100 transition-all border-slate-200 text-slate-900 bg-white">
                      <Filter className="w-5 h-5" /> Filters
                    </button>
                  </div>

                  <div className="glass rounded-[3rem] overflow-hidden border-slate-200 bg-white shadow-sm">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left">
                        <thead className="bg-white border-b border-slate-100 text-[10px] uppercase font-black tracking-[0.2em] text-muted-foreground">
                          <tr>
                            <th className="px-10 py-6">
                              <input 
                                type="checkbox" 
                                className="w-5 h-5 rounded border-slate-200 bg-white checked:bg-primary transition-all cursor-pointer"
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedIds(inventory.map(i => i.id));
                                  } else {
                                    setSelectedIds([]);
                                  }
                                }}
                                checked={selectedIds.length === inventory.length && inventory.length > 0}
                              />
                            </th>
                            <th className="px-10 py-6">Product Intelligence</th>
                            <th className="px-10 py-6">Category</th>
                            <th className="px-10 py-6">Stock Status</th>
                            <th className="px-10 py-6">Pricing</th>
                            <th className="px-10 py-6 text-right">Operations</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {inventory.filter(item => 
                            (item.name || '').toLowerCase().includes(inventorySearch.toLowerCase()) ||
                            (item.metadata?.sku || '').toLowerCase().includes(inventorySearch.toLowerCase())
                          ).map(item => (
                            <tr key={item.id} className={`hover:bg-slate-100/50 transition-colors group ${selectedIds.includes(item.id) ? 'bg-primary/5' : ''}`}>
                              <td className="px-10 py-6">
                                <input 
                                  type="checkbox" 
                                  className="w-5 h-5 rounded border-slate-200 bg-white checked:bg-primary transition-all cursor-pointer"
                                  checked={selectedIds.includes(item.id)}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setSelectedIds([...selectedIds, item.id]);
                                    } else {
                                      setSelectedIds(selectedIds.filter(id => id !== item.id));
                                    }
                                  }}
                                />
                              </td>
                              <td className="px-10 py-6">
                                <div className="flex items-center gap-6">
                                  <div className="relative shrink-0">
                                    <img src={item.metadata?.image_url || 'https://images.unsplash.com/photo-1544947950-fa07a98d237f?auto=format&fit=crop&q=80&w=800'} alt={item.name} className="w-16 h-20 rounded-xl bg-slate-100 object-cover shadow-lg group-hover:scale-105 transition-transform" />
                                    {item.stock_quantity < 10 && (
                                      <div className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center border-4 border-white">
                                        <div className="w-1.5 h-1.5 bg-white rounded-full animate-ping" />
                                      </div>
                                    )}
                                  </div>
                                  <div>
                                    <p className="font-black text-lg mb-1 text-slate-900">{item.name}</p>
                                    <div className="flex gap-4 text-xs font-bold text-muted-foreground">
                                      <span>SKU: {item.metadata?.sku || 'N/A'}</span>
                                      <span>ID: {item.id.slice(0, 8)}</span>
                                    </div>
                                  </div>
                                </div>
                              </td>
                              <td className="px-10 py-6">
                                <span className="px-4 py-2 bg-primary/10 rounded-full text-[10px] font-black uppercase tracking-widest text-primary border border-primary/20">{categories.find(c => c.id === item.category_id)?.name || 'General'}</span>
                              </td>
                              <td className="px-10 py-6">
                                <div className="space-y-2">
                                  <p className="font-black text-xl text-slate-900">{item.stock_quantity}</p>
                                  <div className="w-24 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                    <div 
                                      className={`h-full rounded-full transition-all duration-1000 ${
                                        item.stock_quantity < 10 ? 'bg-red-500' : 'bg-green-500'
                                      }`}
                                      style={{ width: `${Math.min((item.stock_quantity / 50) * 100, 100)}%` }}
                                    />
                                  </div>
                                </div>
                              </td>
                              <td className="px-10 py-6">
                                <p className="font-black text-2xl text-primary">{formatPrice(item.price)}</p>
                              </td>
                              <td className="px-10 py-6 text-right">
                                <div className="flex justify-end gap-3 opacity-0 group-hover:opacity-100 transition-all transform translate-x-4 group-hover:translate-x-0">
                                  <button 
                                    onClick={() => {
                                      setModalType('product');
                                      setModalData(item);
                                      setProductForm({
                                        title: item.name,
                                        category: item.category_id,
                                        price: item.price,
                                        stock_quantity: item.stock_quantity,
                                        description: item.description || '',
                                        image_url: item.metadata?.image_url || '',
                                        sku: item.metadata?.sku || '',
                                        isbn: item.metadata?.isbn || ''
                                      });
                                      setIsModalOpen(true);
                                    }}
                                    className="p-4 glass rounded-2xl hover:bg-primary hover:text-white transition-all border-slate-200 text-slate-600 bg-white"
                                  >
                                    <Edit className="w-5 h-5" />
                                  </button>
                                  <button 
                                    onClick={() => handleDelete('products', item.id)}
                                    className="p-4 glass rounded-2xl hover:bg-red-500 hover:text-white transition-all border-slate-200 text-slate-600 bg-white"
                                  >
                                    <Trash2 className="w-5 h-5" />
                                  </button>
                                  <button className="p-4 glass rounded-2xl hover:bg-slate-100 transition-all border-slate-200 text-slate-600 bg-white"><MoreVertical className="w-5 h-5" /></button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </motion.div>
              )}

              {activeTab === 'orders' && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className="text-3xl font-black mb-2 text-slate-900">Logistics Authority</h3>
                      <p className="text-muted-foreground">Order Fulfillment and Status Governance</p>
                    </div>
                    <button className="glass px-8 py-4 rounded-2xl font-black text-sm hover:bg-slate-100 transition-all border-slate-200 text-slate-900 bg-white">Export Manifest</button>
                  </div>

                  <div className="glass rounded-[3rem] overflow-hidden border-slate-200 bg-white shadow-sm">
                    <table className="w-full text-left">
                      <thead className="bg-white border-b border-slate-100 text-[10px] uppercase font-black tracking-widest text-muted-foreground">
                        <tr>
                          <th className="px-10 py-6">Order Signature</th>
                          <th className="px-10 py-6">Consignee</th>
                          <th className="px-10 py-6">Fulfillment Status</th>
                          <th className="px-10 py-6">Transaction</th>
                          <th className="px-10 py-6 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {orders.map((order) => (
                          <tr key={order.id} className="hover:bg-slate-100/50 transition-all group">
                            <td className="px-10 py-6">
                              <p className="font-black text-lg text-slate-900">#RM-{order.id.slice(0, 8).toUpperCase()}</p>
                              <p className="text-xs text-muted-foreground font-bold">{new Date(order.created_at).toLocaleString()}</p>
                            </td>
                            <td className="px-10 py-6">
                              <p className="font-black text-slate-900">{order.profiles?.full_name || 'Guest User'}</p>
                              <p className="text-xs text-muted-foreground font-medium">{order.profiles?.email || 'No Email'}</p>
                            </td>
                            <td className="px-10 py-6">
                              <div className="flex items-center gap-3">
                                <div className={`w-2 h-2 rounded-full animate-pulse ${
                                  order.status === 'completed' ? 'bg-green-500' :
                                  order.status === 'processing' ? 'bg-blue-500' :
                                  'bg-amber-500'
                                }`} />
                                <span className={`px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest border ${
                                  order.status === 'completed' ? 'bg-green-500/10 text-green-500 border-green-500/20' :
                                  order.status === 'processing' ? 'bg-blue-500/10 text-blue-500 border-blue-500/20' :
                                  'bg-amber-500/10 text-amber-500 border-amber-500/20'
                                }`}>
                                  {order.status}
                                </span>
                              </div>
                            </td>
                            <td className="px-10 py-6 font-black text-xl text-primary">{formatPrice(order.total_amount)}</td>
                            <td className="px-10 py-6 text-right">
                              <div className="flex justify-end items-center gap-3">
                                <div className="flex glass rounded-xl overflow-hidden border-slate-200 bg-white">
                                  <button 
                                    onClick={() => handleStatusUpdate(order.id, 'processing')}
                                    className={`px-4 py-3 text-[10px] font-black uppercase tracking-widest transition-all ${order.status === 'processing' ? 'bg-blue-500 text-white' : 'hover:bg-slate-100 text-blue-500'}`}
                                    title="Set to Processing"
                                  >
                                    Proc
                                  </button>
                                  <button 
                                    onClick={() => handleStatusUpdate(order.id, 'completed')}
                                    className={`px-4 py-3 text-[10px] font-black uppercase tracking-widest transition-all ${order.status === 'completed' ? 'bg-green-500 text-white' : 'hover:bg-slate-100 text-green-500'}`}
                                    title="Set to Completed"
                                  >
                                    Done
                                  </button>
                                </div>
                                <button 
                                  onClick={() => handleDelete('orders', order.id)}
                                  className="p-3 glass rounded-xl text-red-500 hover:bg-red-500 hover:text-white transition-all border-slate-200 bg-white"
                                  title="Delete Order"
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
                </motion.div>
              )}

              {activeTab === 'shipping' && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className="text-3xl font-black mb-2 text-slate-900">Regional Management</h3>
                      <p className="text-muted-foreground">Geographic Strategy and Price Floors</p>
                    </div>
                    <button 
                      onClick={() => { 
                        setModalType('shipping'); 
                        setModalData(null);
                        setShippingForm({ name: '', base_rate: 0, description: '' });
                        setIsModalOpen(true); 
                      }}
                      className="bg-primary text-white px-8 py-4 rounded-2xl font-black text-sm shadow-lg shadow-primary/20 hover:scale-105 transition-transform"
                    >
                      Add Delivery Region
                    </button>
                  </div>

                  <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {shipping.map((zone) => (
                      <div key={zone.id} className="glass p-10 rounded-[3rem] relative group overflow-hidden border-slate-200 bg-white shadow-sm">
                        <div className="absolute -right-8 -bottom-8 opacity-5 group-hover:opacity-10 transition-opacity rotate-12">
                          <Truck className="w-40 h-40" />
                        </div>
                        <div className="flex justify-between items-start mb-8">
                          <div className="p-4 bg-primary/10 rounded-2xl text-primary">
                            <MapPin className="w-6 h-6" />
                          </div>
                          <p className="text-3xl font-black text-primary">{formatPrice(zone.base_rate)}</p>
                        </div>
                        <h4 className="text-2xl font-black mb-2 text-slate-900">{zone.name}</h4>
                        <p className="text-muted-foreground font-medium mb-10 leading-relaxed">{zone.description || 'Global shipping zone with standard delivery protocols.'}</p>
                        <div className="flex gap-3">
                          <button 
                            onClick={() => {
                              setModalType('shipping');
                              setModalData(zone);
                              setShippingForm({
                                name: zone.name,
                                base_rate: zone.base_rate,
                                description: zone.description || ''
                              });
                              setIsModalOpen(true);
                            }}
                            className="flex-[2] py-4 glass rounded-2xl font-black text-xs hover:bg-slate-100 transition-all uppercase tracking-widest border-slate-200 text-slate-600 bg-white"
                          >
                            Adjust Rate
                          </button>
                          <button 
                            onClick={() => handleDelete('shipping_zones', zone.id)}
                            className="flex-1 p-4 glass rounded-2xl text-red-500 hover:bg-red-500 hover:text-white transition-all flex items-center justify-center border-slate-200 bg-white"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}

              {activeTab === 'promos' && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className="text-3xl font-black mb-2 text-slate-900">Revenue Manipulation</h3>
                      <p className="text-muted-foreground">Growth Hacking and Campaign Governance</p>
                    </div>
                    <button 
                      onClick={() => { 
                        setModalType('promo'); 
                        setModalData(null);
                        setPromoForm({
                          code: '',
                          discount_type: 'percentage',
                          discount_value: 0,
                          usage_limit: 100,
                          expires_at: ''
                        });
                        setIsModalOpen(true); 
                      }}
                      className="bg-primary text-white px-8 py-4 rounded-2xl font-black text-sm shadow-lg shadow-primary/20 hover:scale-105 transition-transform"
                    >
                      Initialize Campaign
                    </button>
                  </div>

                  <div className="glass rounded-[3rem] overflow-hidden border-slate-200 bg-white shadow-sm">
                    <table className="w-full text-left">
                      <thead className="bg-white border-b border-slate-100 text-[10px] uppercase font-black tracking-widest text-muted-foreground">
                        <tr>
                          <th className="px-10 py-6">Promo Signature</th>
                          <th className="px-10 py-6">Impact Value</th>
                          <th className="px-10 py-6">Utilization</th>
                          <th className="px-10 py-6">Temporal Limit</th>
                          <th className="px-10 py-6 text-right">Command</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {promos.map((promo) => (
                          <tr key={promo.id} className="hover:bg-slate-100/50 transition-all group">
                            <td className="px-10 py-6">
                              <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary font-black">
                                  <Tag className="w-5 h-5" />
                                </div>
                                <span className="font-black text-xl tracking-tight text-primary uppercase">{promo.code}</span>
                              </div>
                            </td>
                            <td className="px-10 py-6">
                              <p className="font-black text-2xl text-slate-900">
                                {promo.discount_type === 'percentage' ? `${promo.discount_value}%` : formatPrice(promo.discount_value)}
                              </p>
                              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mt-1">{promo.discount_type}</p>
                            </td>
                            <td className="px-10 py-6">
                              <div className="space-y-2">
                                <div className="flex justify-between text-xs font-black">
                                  <span className="text-slate-900">{promo.usage_count} Used</span>
                                  <span className="text-muted-foreground">Limit: {promo.usage_limit || '∞'}</span>
                                </div>
                                <div className="w-32 h-2 bg-slate-100 rounded-full overflow-hidden">
                                  <div 
                                    className="h-full bg-primary rounded-full transition-all duration-1000"
                                    style={{ width: `${Math.min((promo.usage_count / (promo.usage_limit || 100)) * 100, 100)}%` }}
                                  />
                                </div>
                              </div>
                            </td>
                            <td className="px-10 py-6">
                              <p className="font-black text-sm text-slate-900">{promo.expires_at ? new Date(promo.expires_at).toLocaleDateString() : 'PERPETUAL'}</p>
                            </td>
                            <td className="px-10 py-6 text-right">
                              <div className="flex justify-end items-center gap-3">
                                <button 
                                  onClick={() => {
                                    setModalType('promo');
                                    setModalData(promo);
                                    setPromoForm({
                                      code: promo.code,
                                      discount_type: promo.discount_type,
                                      discount_value: promo.discount_value,
                                      usage_limit: promo.usage_limit,
                                      expires_at: promo.expires_at ? promo.expires_at.split('T')[0] : ''
                                    });
                                    setIsModalOpen(true);
                                  }}
                                  className="p-3 glass rounded-xl hover:bg-slate-100 transition-all border-slate-200 text-slate-600 bg-white"
                                >
                                  <Edit className="w-4 h-4" />
                                </button>
                                <button 
                                  onClick={() => handleTogglePromo(promo.id, promo.is_active)}
                                  className={`px-6 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${
                                    promo.is_active ? 'bg-green-100 text-green-600 border border-green-200' : 'bg-red-100 text-red-600 border border-red-200'
                                  }`}
                                >
                                  {promo.is_active ? 'DEACTIVATE' : 'ACTIVATE'}
                                </button>
                                <button 
                                  onClick={() => handleDelete('promos', promo.id)}
                                  className="p-3 glass rounded-xl text-red-500 hover:bg-red-500 hover:text-white transition-all border-slate-200 bg-white"
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
                </motion.div>
              )}

              {activeTab === 'banners' && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-12">
                  {/* Hero Management Section */}
                  <div className="space-y-8">
                    <div>
                      <h3 className="text-3xl font-black mb-2 text-slate-900">Hero Experience</h3>
                      <p className="text-muted-foreground">Primary Landing Page Narrative and Imagery</p>
                    </div>

                    <div className="grid lg:grid-cols-2 gap-8">
                      {/* Hero Editor */}
                      <form onSubmit={handleHeroSave} className="glass p-8 md:p-10 rounded-[3rem] space-y-6 border-slate-200 bg-white shadow-sm">
                        <div className="space-y-2">
                          <label className="text-[10px] uppercase font-black tracking-widest text-muted-foreground ml-2">Headline</label>
                          <input 
                            type="text" 
                            value={heroForm.title}
                            onChange={(e) => setHeroForm({...heroForm, title: e.target.value})}
                            className="w-full px-6 py-4 rounded-2xl outline-none focus:ring-2 focus:ring-primary font-black text-xl border border-slate-200 bg-white text-slate-900"
                            placeholder="EVERY PAGE TELLS A STORY"
                          />
                        </div>

                        <div className="space-y-2">
                          <label className="text-[10px] uppercase font-black tracking-widest text-muted-foreground ml-2">Sub-Narrative</label>
                          <textarea 
                            value={heroForm.content}
                            onChange={(e) => setHeroForm({...heroForm, content: e.target.value})}
                            className="w-full px-6 py-4 rounded-2xl outline-none focus:ring-2 focus:ring-primary min-h-[120px] resize-none font-medium border border-slate-200 bg-white text-slate-900"
                            placeholder="Discover a curated sanctuary..."
                          />
                        </div>

                        <div className="space-y-2">
                          <label className="text-[10px] uppercase font-black tracking-widest text-muted-foreground ml-2">Book Imagery (URL)</label>
                          <div className="relative">
                            <ImageIcon className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                            <input 
                              type="text" 
                              value={heroForm.image_url}
                              onChange={(e) => setHeroForm({...heroForm, image_url: e.target.value})}
                              className="w-full pl-14 pr-6 py-4 rounded-2xl outline-none focus:ring-2 focus:ring-primary font-medium border border-slate-200 bg-white text-slate-900"
                              placeholder="https://images.unsplash.com/..."
                            />
                          </div>
                          <p className="text-[10px] text-muted-foreground ml-2">Provide a high-quality book-related image URL</p>
                        </div>

                        <button 
                          type="submit"
                          disabled={isLoading}
                          className="w-full bg-primary text-white py-5 rounded-2xl font-black text-lg shadow-xl shadow-primary/20 hover:opacity-90 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
                        >
                          {isLoading ? <RefreshCw className="w-6 h-6 animate-spin" /> : 'Synchronize Hero Section'}
                        </button>
                      </form>

                      {/* Live Preview */}
                      <div className="glass rounded-[3rem] overflow-hidden flex flex-col border border-slate-200 bg-white shadow-sm">
                        <div className="p-6 border-b border-slate-100 bg-white">
                          <div className="flex items-center gap-3">
                            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-900">Real-time Preview</span>
                          </div>
                        </div>
                        <div className="flex-1 p-8 md:p-12 bg-white relative overflow-hidden group">
                          {/* Simulated Hero Section */}
                          <div className="absolute top-0 left-0 w-64 h-64 bg-primary/10 rounded-full blur-[80px] -translate-x-1/2 -translate-y-1/2" />
                          
                          <div className="relative z-10 grid gap-8 h-full">
                            <div className="space-y-6">
                              <h1 className="text-4xl font-black tracking-tighter leading-[0.9] uppercase text-slate-900">
                                {heroForm.title.split('\n').map((line, i) => (
                                  <span key={i} className={i > 0 ? "bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent" : ""}>
                                    {line}<br />
                                  </span>
                                ))}
                              </h1>
                              <p className="text-sm text-muted-foreground leading-relaxed font-medium line-clamp-3">
                                {heroForm.content}
                              </p>
                              <div className="flex gap-4">
                                <div className="px-6 py-3 bg-primary rounded-xl text-[10px] font-black text-white cursor-default">SHOP</div>
                                <div className="px-6 py-3 glass rounded-xl text-[10px] font-black text-slate-400 border border-slate-200 cursor-default bg-white">CLUB</div>
                              </div>
                            </div>
                            
                            <div className="relative aspect-square rounded-2xl overflow-hidden shadow-2xl border border-slate-200 bg-white">
                              <img 
                                src={heroForm.image_url} 
                                alt="Preview" 
                                className="w-full h-full object-cover"
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <hr className="border-slate-200" />

                  {/* Secondary Banners */}
                  <div className="space-y-8">
                    <div className="flex justify-between items-center">
                      <div>
                        <h3 className="text-3xl font-black mb-2 text-slate-900">Promotional Banners</h3>
                        <p className="text-muted-foreground">Secondary Campaign Visuals and Announcements</p>
                      </div>
                      <button 
                        onClick={() => { 
                          setModalType('banner'); 
                          setModalData(null);
                          setBannerForm({
                            title: '',
                            content: '',
                            image_url: '',
                            type: 'banner',
                            is_active: true
                          });
                          setIsModalOpen(true); 
                        }}
                        className="glass px-8 py-4 rounded-2xl font-black text-sm hover:bg-slate-100 transition-all border border-slate-200 text-slate-600 bg-white"
                      >
                        Deploy New Visual
                      </button>
                    </div>

                    <div className="grid md:grid-cols-2 gap-8">
                      {cms.filter(item => item.type === 'banner').map((banner) => (
                        <div key={banner.id} className="glass rounded-[3rem] overflow-hidden group border border-slate-200 bg-white shadow-sm">
                          <div className="relative h-64 overflow-hidden">
                            <img src={banner.image_url} alt={banner.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                            <div className="absolute inset-0 bg-gradient-to-t from-white/40 via-transparent to-transparent" />
                          </div>
                          <div className="p-8">
                            <h4 className="text-2xl font-black mb-2 text-slate-900">{banner.title}</h4>
                            <p className="text-muted-foreground font-medium mb-8 line-clamp-2">{banner.content}</p>
                            <div className="flex gap-4">
                              <button 
                                onClick={() => {
                                  setModalType('banner');
                                  setModalData(banner);
                                  setBannerForm({
                                    title: banner.title,
                                    content: banner.content,
                                    image_url: banner.image_url,
                                    type: 'banner',
                                    is_active: banner.is_active
                                  });
                                  setIsModalOpen(true);
                                }}
                                className="flex-1 py-4 glass rounded-2xl font-black text-xs hover:bg-slate-100 transition-all uppercase tracking-widest border border-slate-200 text-slate-600 bg-white"
                              >
                                Edit Layout
                              </button>
                              <button 
                                onClick={() => handleDelete('cms_content', banner.id)}
                                className="p-4 glass rounded-2xl text-red-500 hover:bg-red-500 hover:text-white transition-all border border-slate-200 bg-white"
                              >
                                <Trash2 className="w-5 h-5" />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}

              {activeTab === 'events' && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className="text-3xl font-black mb-2 text-slate-900">Experience Coordination</h3>
                      <p className="text-muted-foreground">Community Orchestration and Scheduled Events</p>
                    </div>
                    <button 
                      onClick={() => { 
                        setModalType('event'); 
                        setModalData(null);
                        setEventForm({
                          title: '',
                          published_at: '',
                          metadata: {
                            location: '',
                            registrations_count: 0
                          }
                        });
                        setIsModalOpen(true); 
                      }}
                      className="bg-primary text-white px-8 py-4 rounded-2xl font-black text-sm shadow-lg shadow-primary/20 hover:scale-105 transition-transform"
                    >
                      Schedule New Event
                    </button>
                  </div>

                  <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {events.map((event) => (
                      <div key={event.id} className="glass p-10 rounded-[3rem] relative group hover:bg-slate-100/50 transition-all border border-slate-200 bg-white shadow-sm">
                        <div className="flex items-start justify-between mb-8">
                          <div className="w-20 h-20 rounded-[2rem] bg-gradient-to-br from-primary/10 to-secondary/10 flex flex-col items-center justify-center border border-slate-100">
                            <span className="text-2xl font-black text-primary">{new Date(event.published_at).getDate()}</span>
                            <span className="text-[10px] font-black uppercase tracking-widest text-primary/60">{new Date(event.published_at).toLocaleString('default', { month: 'short' })}</span>
                          </div>
                          <div className="flex gap-2">
                            <button 
                              onClick={() => {
                                setModalType('event');
                                setModalData(event);
                                setEventForm({
                                  title: event.title,
                                  published_at: event.published_at ? event.published_at.split('T')[0] : '',
                                  metadata: {
                                    location: event.metadata?.location || '',
                                    registrations_count: event.metadata?.registrations_count || 0
                                  }
                                });
                                setIsModalOpen(true);
                              }}
                              className="p-3 glass rounded-xl hover:bg-slate-100 transition-all border border-slate-200 text-slate-600 bg-white"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={() => handleDelete('cms_content', event.id)}
                              className="p-3 glass rounded-xl text-red-500 hover:bg-red-500 hover:text-white transition-all border border-slate-200 bg-white"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                        <h4 className="text-2xl font-black mb-4 group-hover:text-primary transition-colors text-slate-900">{event.title}</h4>
                        <div className="space-y-3 mb-10">
                          <div className="flex items-center gap-3 text-muted-foreground">
                            <MapPin className="w-4 h-4 text-primary" />
                            <span className="text-sm font-bold">{event.metadata?.location || 'ReadMart Hub'}</span>
                          </div>
                          <div className="flex items-center gap-3 text-muted-foreground">
                            <Users className="w-4 h-4 text-primary" />
                            <span className="text-sm font-bold">{event.metadata?.registrations_count || 0} Registrations</span>
                          </div>
                        </div>
                        <button className="w-full py-4 glass rounded-2xl font-black text-xs hover:bg-primary hover:text-white transition-all uppercase tracking-widest border border-slate-200 text-slate-600 bg-white">Manage Experience</button>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}

              {activeTab === 'inquiries' && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className="text-3xl font-black mb-2 text-slate-900">Communication Hub</h3>
                      <p className="text-muted-foreground">Inbound Inquiries and Support Governance</p>
                    </div>
                  </div>

                  <div className="grid gap-8">
                    {inquiries.map((inquiry) => (
                      <div key={inquiry.id} className="glass p-10 rounded-[3rem] border-slate-200 bg-white shadow-sm space-y-8">
                        <div className="flex flex-col md:flex-row justify-between gap-8">
                          <div className="space-y-4 flex-1">
                            <div className="flex items-center gap-4">
                              <div className="p-4 bg-primary/10 rounded-2xl text-primary">
                                <MessageSquare className="w-6 h-6" />
                              </div>
                              <div>
                                <h4 className="text-2xl font-black text-slate-900">{inquiry.subject || 'General Inquiry'}</h4>
                                <p className="text-muted-foreground font-bold">{inquiry.full_name} ({inquiry.email})</p>
                              </div>
                            </div>
                            <div className="bg-white p-6 rounded-2xl border border-slate-100">
                              <p className="text-muted-foreground font-medium leading-relaxed">{inquiry.message}</p>
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-4">
                            <span className={`px-6 py-3 rounded-2xl text-xs font-black uppercase tracking-widest border ${
                              inquiry.status === 'resolved' ? 'bg-green-100 text-green-600 border-green-200' :
                              inquiry.status === 'in_progress' ? 'bg-blue-100 text-blue-600 border-blue-200' :
                              'bg-amber-100 text-amber-600 border-amber-200 animate-pulse'
                            }`}>
                              {inquiry.status || 'pending'}
                            </span>
                            <div className="flex gap-3">
                              <button 
                                onClick={() => handleInquiryStatusUpdate(inquiry.id, 'resolved')}
                                className="px-6 py-3 bg-green-500/10 text-green-500 rounded-xl font-black text-[10px] uppercase hover:bg-green-500 hover:text-white transition-all"
                              >
                                Resolve
                              </button>
                              <button 
                                onClick={() => handleInquiryStatusUpdate(inquiry.id, 'in_progress')}
                                className="px-6 py-3 bg-blue-500/10 text-blue-500 rounded-xl font-black text-[10px] uppercase hover:bg-blue-500 hover:text-white transition-all"
                              >
                                Process
                              </button>
                            </div>
                          </div>
                        </div>
                        <div className="pt-8 border-t border-slate-100 flex items-center justify-between">
                          <p className="text-xs text-muted-foreground font-bold">Received on {new Date(inquiry.created_at).toLocaleString()}</p>
                          <button 
                            onClick={() => handleDelete('contact_messages', inquiry.id)}
                            className="p-4 glass rounded-2xl text-red-500 hover:bg-red-500 hover:text-white transition-all border-slate-200 bg-white"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}

              {activeTab === 'partnerships' && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className="text-3xl font-black mb-2 text-slate-900">Strategic Partnerships</h3>
                      <p className="text-muted-foreground">Collaborations and Ecosystem Expansion</p>
                    </div>
                  </div>

                  <div className="grid gap-8">
                    {partnerships.map((partner) => (
                      <div key={partner.id} className="glass p-10 rounded-[3rem] border-slate-200 bg-white shadow-sm space-y-8">
                        <div className="flex flex-col md:flex-row justify-between gap-8">
                          <div className="space-y-4">
                            <div className="flex items-center gap-4">
                              <div className="p-4 bg-primary/10 rounded-2xl text-primary">
                                <Building2 className="w-6 h-6" />
                              </div>
                              <div>
                                <h4 className="text-2xl font-black text-slate-900">{partner.organization}</h4>
                                <p className="text-muted-foreground font-bold">{partner.service_type}</p>
                              </div>
                            </div>
                            <p className="text-muted-foreground font-medium max-w-2xl">{partner.description}</p>
                          </div>
                          <div className="flex flex-col items-end gap-4">
                            <span className={`px-6 py-3 rounded-2xl text-xs font-black uppercase tracking-widest border ${
                              partner.status === 'approved' ? 'bg-green-100 text-green-600 border-green-200' :
                              partner.status === 'rejected' ? 'bg-red-100 text-red-600 border-red-200' :
                              'bg-amber-100 text-amber-600 border-amber-200 animate-pulse'
                            }`}>
                              {partner.status}
                            </span>
                            <div className="flex gap-3">
                              <button 
                                onClick={() => handlePartnershipStatusUpdate(partner.id, 'approved')}
                                className="px-6 py-3 bg-green-500/10 text-green-500 rounded-xl font-black text-[10px] uppercase hover:bg-green-500 hover:text-white transition-all"
                              >
                                Approve
                              </button>
                              <button 
                                onClick={() => handlePartnershipStatusUpdate(partner.id, 'rejected')}
                                className="px-6 py-3 bg-red-500/10 text-red-500 rounded-xl font-black text-[10px] uppercase hover:bg-red-500 hover:text-white transition-all"
                              >
                                Reject
                              </button>
                            </div>
                          </div>
                        </div>
                        <div className="pt-8 border-t border-slate-100 flex items-center justify-between">
                          <div className="flex gap-8">
                            <div>
                              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1">Point of Contact</p>
                              <p className="font-bold text-slate-900">{partner.full_name}</p>
                            </div>
                            <div>
                              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1">Corporate Email</p>
                              <p className="font-bold text-slate-900">{partner.email}</p>
                            </div>
                          </div>
                          <button 
                            onClick={() => handleDelete('partnership_applications', partner.id)}
                            className="p-4 glass rounded-2xl text-red-500 hover:bg-red-500 hover:text-white transition-all border-slate-200 bg-white"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}

              {activeTab === 'author-apps' && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className="text-3xl font-black mb-2 text-slate-900">Author Applications</h3>
                      <p className="text-muted-foreground">Reviewing New Creative Intelligence</p>
                    </div>
                  </div>

                  <div className="grid gap-8">
                    {authorApps.map((app) => (
                      <div key={app.id} className="glass p-10 rounded-[3rem] border-slate-200 bg-white shadow-sm space-y-8">
                        <div className="flex flex-col md:flex-row justify-between gap-8">
                          <div className="space-y-4 flex-1">
                            <div className="flex items-center gap-4">
                              <div className="p-4 bg-rose-500/10 rounded-2xl text-rose-500">
                                <PenTool className="w-6 h-6" />
                              </div>
                              <div>
                                <h4 className="text-2xl font-black text-slate-900">{app.full_name}</h4>
                                <p className="text-muted-foreground font-bold">{app.email}</p>
                              </div>
                            </div>
                            <div className="bg-white p-6 rounded-2xl border border-slate-100">
                              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-3">Author Bio & Vision</p>
                              <p className="text-muted-foreground font-medium leading-relaxed">{app.bio}</p>
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-4 min-w-[200px]">
                            <span className={`px-6 py-3 rounded-2xl text-xs font-black uppercase tracking-widest border ${
                              app.status === 'approved' ? 'bg-green-100 text-green-600 border-green-200' :
                              app.status === 'rejected' ? 'bg-red-100 text-red-600 border-red-200' :
                              'bg-amber-100 text-amber-600 border-amber-200 animate-pulse'
                            }`}>
                              {app.status}
                            </span>
                            <div className="flex gap-3">
                              <button 
                                onClick={() => handleAuthorStatusUpdate(app.id, 'approved')}
                                className="px-6 py-3 bg-green-500/10 text-green-500 rounded-xl font-black text-[10px] uppercase hover:bg-green-500 hover:text-white transition-all"
                              >
                                Onboard Author
                              </button>
                              <button 
                                onClick={() => handleAuthorStatusUpdate(app.id, 'rejected')}
                                className="px-6 py-3 bg-red-500/10 text-red-500 rounded-xl font-black text-[10px] uppercase hover:bg-red-500 hover:text-white transition-all"
                              >
                                Decline
                              </button>
                            </div>
                          </div>
                        </div>
                        <div className="pt-8 border-t border-slate-100 flex items-center justify-between">
                          <p className="text-xs text-muted-foreground font-bold">Submitted on {new Date(app.created_at).toLocaleString()}</p>
                          <button 
                            onClick={() => handleDelete('author_applications', app.id)}
                            className="p-4 glass rounded-2xl text-red-500 hover:bg-red-500 hover:text-white transition-all border-slate-200 bg-white"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}

              {activeTab === 'clubs' && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className="text-3xl font-black mb-2 text-slate-900">Community Hubs</h3>
                      <p className="text-muted-foreground">Book Club Governance and Engagement</p>
                    </div>
                    <button 
                      onClick={() => { 
                        setModalType('club'); 
                        setModalData(null);
                        setClubForm({ title: '', description: '', is_active: true, metadata: { members_count: 0 } });
                        setIsModalOpen(true); 
                      }}
                      className="bg-primary text-white px-8 py-4 rounded-2xl font-black text-sm shadow-lg shadow-primary/20"
                    >
                      Inaugurate Book Club
                    </button>
                  </div>

                  <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {clubs.map((club) => (
                      <div key={club.id} className="glass p-10 rounded-[3rem] relative group border-slate-200 bg-white shadow-sm">
                        <div className="flex justify-between items-start mb-8">
                          <div className="p-4 bg-orange-500/10 rounded-2xl text-orange-500">
                            <Users2 className="w-8 h-8" />
                          </div>
                          <div className="flex gap-2">
                            <button 
                              onClick={() => {
                                setModalType('club');
                                setModalData(club);
                                setClubForm({
                                  title: club.title,
                                  description: club.description || '',
                                  is_active: club.is_active,
                                  metadata: { members_count: club.metadata?.members_count || 0 }
                                });
                                setIsModalOpen(true);
                              }}
                              className="p-3 glass rounded-xl hover:bg-slate-100 transition-all border-slate-200 text-slate-600 bg-white"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={() => handleDelete('book_clubs', club.id)}
                              className="p-3 glass rounded-xl text-red-500 hover:bg-red-500 hover:text-white transition-all border-slate-200 bg-white"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                        <h4 className="text-2xl font-black mb-2 text-slate-900">{club.title}</h4>
                        <p className="text-muted-foreground font-medium mb-8 line-clamp-3">{club.description}</p>
                        <div className="flex items-center justify-between pt-6 border-t border-slate-50">
                          <div className="flex items-center gap-2">
                            <Users className="w-4 h-4 text-primary" />
                            <span className="text-xs font-black text-slate-900">{club.metadata?.members_count || 0} Members</span>
                          </div>
                          <span className={`px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest border ${
                            club.is_active ? 'bg-green-500/10 text-green-500 border-green-500/20' : 'bg-amber-500/10 text-amber-500 border-amber-500/20'
                          }`}>
                            {club.is_active ? 'Active' : 'Archived'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}

              {activeTab === 'users' && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className="text-3xl font-black mb-2 text-slate-900">Demographic Insight</h3>
                      <p className="text-muted-foreground">Security, Safety, and Demographic Intelligence</p>
                    </div>
                    <button 
                      onClick={() => { 
                        setModalType('user'); 
                        setModalData(null);
                        setUserForm({ full_name: '', email: '', role: 'customer', is_active: true });
                        setIsModalOpen(true); 
                      }}
                      className="bg-primary text-white px-8 py-4 rounded-2xl font-black text-sm shadow-lg shadow-primary/20"
                    >
                      Register Protocol User
                    </button>
                  </div>

                  <div className="glass rounded-[3rem] overflow-hidden border-slate-200 bg-white shadow-sm">
                    <table className="w-full text-left">
                      <thead className="bg-white border-b border-slate-100 text-[10px] uppercase font-black tracking-widest text-muted-foreground">
                        <tr>
                          <th className="px-10 py-6">User Profile</th>
                          <th className="px-10 py-6">Authority Level</th>
                          <th className="px-10 py-6">Active Status</th>
                          <th className="px-10 py-6 text-right">Security Operations</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {users.map((user) => (
                          <tr key={user.id} className="hover:bg-slate-100 transition-all group">
                            <td className="px-10 py-6">
                              <div className="flex items-center gap-6">
                                <div className="w-16 h-16 rounded-[1.5rem] bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center text-primary font-black text-2xl border border-slate-100">
                                  {user.full_name?.charAt(0) || user.email?.charAt(0) || '?'}
                                </div>
                                <div>
                                  <p className="font-black text-lg text-slate-900">{user.full_name || 'Anonymous Entity'}</p>
                                  <p className="text-xs text-muted-foreground font-bold">{user.email}</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-10 py-6">
                              <span className={`px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest border ${
                                user.role === 'founder' ? 'bg-purple-100 text-purple-600 border-purple-200' :
                                user.role === 'author' ? 'bg-blue-100 text-blue-600 border-blue-200' :
                                user.role === 'partner' ? 'bg-orange-100 text-orange-600 border-orange-200' :
                                'bg-slate-100 text-slate-600 border-slate-200'
                              }`}>
                                {user.role}
                              </span>
                            </td>
                            <td className="px-10 py-6">
                              <div className="flex items-center gap-3">
                                <div className={`w-3 h-3 rounded-full ${user.is_active ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]' : 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.4)]'}`} />
                                <span className="text-sm font-black uppercase tracking-widest text-slate-600">{user.is_active ? 'Active' : 'Suspended'}</span>
                              </div>
                            </td>
                            <td className="px-10 py-6 text-right">
                              <div className="flex justify-end gap-3 opacity-0 group-hover:opacity-100 transition-all">
                                <button 
                                  onClick={() => {
                                    setModalType('user');
                                    setModalData(user);
                                    setUserForm({
                                      full_name: user.full_name || '',
                                      email: user.email || '',
                                      role: user.role || 'customer',
                                      is_active: user.is_active
                                    });
                                    setIsModalOpen(true);
                                  }}
                                  className="p-4 glass rounded-2xl hover:bg-slate-100 transition-all border-slate-200 text-slate-400 hover:text-primary bg-white" 
                                  title="Adjust Permissions"
                                >
                                  <Shield className="w-5 h-5" />
                                </button>
                                <button className="p-4 glass rounded-2xl hover:bg-slate-100 transition-all border-slate-200 text-slate-400 hover:text-amber-500 bg-white" title="View Purchase History"><Eye className="w-5 h-5" /></button>
                                <button 
                                  onClick={() => handleUserStatusUpdate(user.id, user.is_active)}
                                  className={`p-4 glass rounded-2xl transition-all border-slate-200 ${user.is_active ? 'text-amber-500 hover:bg-amber-500' : 'text-green-500 hover:bg-green-500'} hover:text-white bg-white`}
                                  title={user.is_active ? "Suspend Account" : "Activate Account"}
                                >
                                  <Power className="w-5 h-5" />
                                </button>
                                <button 
                                  onClick={() => handleDelete('profiles', user.id)}
                                  className="p-4 glass rounded-2xl text-red-500 hover:bg-red-500 hover:text-white transition-all border-slate-200 bg-white"
                                  title="Delete Protocol User"
                                >
                                  <Trash2 className="w-5 h-5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </motion.div>
              )}

              {activeTab === 'team' && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className="text-3xl font-black mb-2 text-slate-900">Internal Hierarchy</h3>
                      <p className="text-muted-foreground">Team Governance and Power Delegation</p>
                    </div>
                    <button 
                      onClick={() => { 
                        setModalType('team'); 
                        setModalData(null);
                        setTeamForm({ full_name: '', email: '', role: 'manager', is_active: true });
                        setIsModalOpen(true); 
                      }}
                      className="bg-primary text-white px-8 py-4 rounded-2xl font-black text-sm shadow-lg shadow-primary/20"
                    >
                      Induct New Member
                    </button>
                  </div>

                  <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {team.map((member) => (
                      <div key={member.id} className="glass p-10 rounded-[3rem] relative group border-slate-200 bg-white shadow-sm">
                        <div className="flex items-center gap-6 mb-8">
                          <div className="w-20 h-20 rounded-[2rem] bg-gradient-to-br from-blue-500/20 to-indigo-500/20 flex items-center justify-center text-blue-500 font-black text-3xl border border-blue-500/10">
                            {member.full_name?.charAt(0) || 'M'}
                          </div>
                          <div>
                            <h4 className="text-xl font-black mb-1 text-slate-900">{member.full_name || 'Team Member'}</h4>
                            <p className="text-xs font-black uppercase tracking-widest text-primary">{member.role}</p>
                          </div>
                        </div>
                        <div className="space-y-4 mb-10">
                          <div className="flex justify-between items-center text-sm">
                            <span className="text-muted-foreground font-bold">Access Level</span>
                            <span className="font-black uppercase tracking-widest text-slate-900">{member.role === 'founder' ? 'Absolute' : 'Limited'}</span>
                          </div>
                          <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full bg-primary rounded-full w-full" />
                          </div>
                        </div>
                        <div className="flex gap-3">
                          <button 
                            onClick={() => {
                              setModalType('team');
                              setModalData(member);
                              setTeamForm({
                                full_name: member.full_name || '',
                                email: member.email || '',
                                role: member.role || 'manager',
                                is_active: member.is_active
                              });
                              setIsModalOpen(true);
                            }}
                            className="flex-1 py-4 glass rounded-2xl font-black text-[10px] hover:bg-slate-100 transition-all uppercase tracking-widest border-slate-200 text-slate-600 bg-white"
                          >
                            Adjust Powers
                          </button>
                          <button 
                            onClick={() => handleUserStatusUpdate(member.id, member.is_active)}
                            className={`p-4 glass rounded-2xl transition-all border-slate-200 ${member.is_active ? 'text-amber-500 hover:bg-amber-500' : 'text-green-500 hover:bg-green-500'} hover:text-white bg-white`}
                            title={member.is_active ? "Suspend Member" : "Activate Member"}
                          >
                            <Power className="w-5 h-5" />
                          </button>
                          <button 
                            onClick={() => handleDelete('profiles', member.id)}
                            className="p-4 glass rounded-2xl text-red-500 hover:bg-red-500 hover:text-white transition-all flex items-center justify-center border-slate-200 bg-white"
                            title="Purge Member"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}

              {activeTab === 'settings' && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-12">
                  <div>
                    <h3 className="text-3xl font-black mb-2 text-slate-900">Global Logic</h3>
                    <p className="text-muted-foreground">Sovereign Control and Global Configuration</p>
                  </div>

                  <form onSubmit={handleSaveSettings} className="grid lg:grid-cols-2 gap-12">
                    {/* Fundamental Constants */}
                    <div className="space-y-8">
                      <div className="glass p-10 rounded-[3rem] space-y-8 border-slate-200 bg-white shadow-sm">
                        <h4 className="text-xl font-black flex items-center gap-3 text-slate-900">
                          <DollarSign className="w-6 h-6 text-primary" />
                          Fundamental Math
                        </h4>
                        <div className="grid sm:grid-cols-2 gap-8">
                          <div className="space-y-3">
                            <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Base Tax Rate (%)</label>
                            <input 
                              type="number" 
                              value={settings?.tax_rate || 16} 
                              onChange={(e) => setSettings({...settings, tax_rate: Number(e.target.value)})}
                              className="w-full bg-white border border-slate-200 rounded-2xl px-6 py-4 font-black focus:ring-2 focus:ring-primary outline-none text-slate-900" 
                            />
                          </div>
                          <div className="space-y-3">
                            <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Default Currency</label>
                            <select 
                              value={settings?.default_currency || 'KES'}
                              onChange={(e) => setSettings({...settings, default_currency: e.target.value})}
                              className="w-full bg-white border border-slate-200 rounded-2xl px-6 py-4 font-black focus:ring-2 focus:ring-primary outline-none appearance-none text-slate-900"
                            >
                              <option value="KES">KES (Kenya Shilling)</option>
                              <option value="USD">USD (US Dollar)</option>
                            </select>
                          </div>
                        </div>
                      </div>

                      <div className="glass p-10 rounded-[3rem] space-y-8 border-slate-200 bg-white shadow-sm">
                        <h4 className="text-xl font-black flex items-center gap-3 text-red-500">
                          <Power className="w-6 h-6" />
                          Critical Overrides
                        </h4>
                        <div className="flex items-center justify-between p-6 bg-red-50 border border-red-100 rounded-3xl">
                          <div>
                            <p className="font-black text-red-500 uppercase tracking-widest">Maintenance Mode</p>
                            <p className="text-xs text-muted-foreground mt-1">Suspend all customer operations immediately</p>
                          </div>
                          <button 
                            type="button"
                            onClick={() => setSettings({...settings, maintenance_mode: !settings?.maintenance_mode})}
                            className={`w-16 h-8 rounded-full relative group transition-all ${settings?.maintenance_mode ? 'bg-red-500' : 'bg-slate-200'}`}
                          >
                            <div className={`absolute top-1 w-6 h-6 bg-white rounded-full transition-all ${settings?.maintenance_mode ? 'right-1' : 'left-1'}`} />
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Site Identity */}
                    <div className="glass p-10 rounded-[3rem] space-y-10 border-slate-200 bg-white shadow-sm">
                      <h4 className="text-xl font-black flex items-center gap-3 text-slate-900">
                        <ImageIcon className="w-6 h-6 text-primary" />
                        Platform Identity
                      </h4>
                      <div className="space-y-8">
                        <div className="flex items-center gap-8">
                          <div className="w-32 h-32 glass rounded-[2.5rem] flex items-center justify-center relative group overflow-hidden border-2 border-dashed border-slate-200 bg-white">
                            <img src={settings?.site_logo || '/assets/logo.jpg'} alt="Site Logo" className="w-20 h-20 object-contain" />
                            <div className="absolute inset-0 bg-white/60 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center cursor-pointer backdrop-blur-sm">
                              <Plus className="w-8 h-8 text-slate-900" />
                            </div>
                          </div>
                          <div className="flex-1 space-y-4">
                            <div className="space-y-2">
                              <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Platform Name</label>
                              <input 
                                type="text" 
                                value={settings?.site_name || 'ReadMart'} 
                                onChange={(e) => setSettings({...settings, site_name: e.target.value})}
                                className="w-full bg-white border border-slate-200 rounded-2xl px-6 py-4 font-black outline-none text-slate-900" 
                              />
                            </div>
                          </div>
                        </div>
                        
                        <div className="space-y-6">
                          <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Global Support WhatsApp</label>
                            <input 
                              type="text" 
                              value={settings?.whatsapp_link || ''} 
                              onChange={(e) => setSettings({...settings, whatsapp_link: e.target.value})}
                              className="w-full bg-white border border-slate-200 rounded-2xl px-6 py-4 font-black outline-none text-slate-900" 
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Headquarters Address</label>
                            <textarea 
                              value={settings?.address || ''} 
                              onChange={(e) => setSettings({...settings, address: e.target.value})}
                              className="w-full bg-white border border-slate-200 rounded-2xl px-6 py-4 font-black outline-none min-h-[120px] resize-none text-slate-900" 
                            />
                          </div>
                        </div>
                      </div>
                      <button 
                        type="submit"
                        className="w-full py-5 bg-primary text-white rounded-[2rem] font-black shadow-xl shadow-primary/20 hover:scale-[1.02] transition-all"
                      >
                        Commit Global Configuration
                      </button>
                    </div>
                  </form>
                </motion.div>
              )}
            </>
          )}
        </main>

        {/* Action Modal */}
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-white/60 backdrop-blur-md" 
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              className="w-full max-w-2xl rounded-[3rem] p-10 relative z-10 overflow-hidden bg-white border border-slate-200 shadow-2xl"
            >
              <div className="flex justify-between items-center mb-8">
                <div>
                  <h3 className="text-2xl font-black uppercase tracking-tight text-slate-900">
                    {modalData ? 'Update' : 'Initialize'} {modalType}
                  </h3>
                  <p className="text-muted-foreground text-sm font-bold">Security Clearance: Founder Level</p>
                </div>
                <button 
                  onClick={() => setIsModalOpen(false)}
                  className="p-4 glass rounded-2xl hover:bg-slate-100 transition-all border-slate-200 text-slate-400 bg-white"
                >
                  <Plus className="w-6 h-6 rotate-45" />
                </button>
              </div>

              <div className="space-y-6 max-h-[60vh] overflow-y-auto pr-4 no-scrollbar">
                {modalType === 'product' && (
                  <form id="productForm" onSubmit={handleProductSave} className="space-y-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Product Title</label>
                      <input 
                        type="text" 
                        required
                        className="w-full bg-white border border-slate-200 rounded-2xl px-6 py-4 font-black outline-none focus:ring-2 focus:ring-primary text-slate-900" 
                        placeholder="Enter title..." 
                        value={productForm.title}
                        onChange={(e) => setProductForm({...productForm, title: e.target.value})}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Category</label>
                        <div className="relative">
                          <select 
                            className="w-full bg-white border border-slate-200 rounded-2xl px-6 py-4 font-black outline-none focus:ring-2 focus:ring-primary appearance-none text-slate-900"
                            value={productForm.category}
                            onChange={(e) => setProductForm({...productForm, category: e.target.value})}
                            required
                          >
                            <option value="">Select Category</option>
                            {categories.map(cat => (
                              <option key={cat.id} value={cat.id}>{cat.name}</option>
                            ))}
                          </select>
                          <ChevronDown className="absolute right-6 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Base Price</label>
                        <input 
                          type="number" 
                          required
                          className="w-full bg-white border border-slate-200 rounded-2xl px-6 py-4 font-black outline-none focus:ring-2 focus:ring-primary text-slate-900" 
                          placeholder="0.00" 
                          value={productForm.price}
                          onChange={(e) => setProductForm({...productForm, price: Number(e.target.value)})}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Stock Quantity</label>
                        <input 
                          type="number" 
                          required
                          className="w-full bg-white border border-slate-200 rounded-2xl px-6 py-4 font-black outline-none focus:ring-2 focus:ring-primary text-slate-900" 
                          placeholder="0" 
                          value={productForm.stock_quantity}
                          onChange={(e) => setProductForm({...productForm, stock_quantity: Number(e.target.value)})}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">SKU / ISBN</label>
                        <input 
                          type="text" 
                          className="w-full bg-white border border-slate-200 rounded-2xl px-6 py-4 font-black outline-none focus:ring-2 focus:ring-primary text-slate-900" 
                          placeholder="SKU-123" 
                          value={productForm.sku}
                          onChange={(e) => setProductForm({...productForm, sku: e.target.value})}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Product Imagery</label>
                      <div 
                        onClick={() => fileInputRef.current?.click()}
                        className="relative group cursor-pointer"
                      >
                        <div className={`w-full aspect-video rounded-[2rem] border-2 border-dashed transition-all flex flex-col items-center justify-center gap-4 overflow-hidden ${selectedFile || productForm.image_url ? 'border-primary/50 bg-primary/5' : 'border-slate-200 bg-white hover:border-primary/50 hover:bg-primary/5'}`}>
                          {selectedFile || productForm.image_url ? (
                            <>
                              <img 
                                src={selectedFile ? URL.createObjectURL(selectedFile) : productForm.image_url} 
                                alt="Preview" 
                                className="w-full h-full object-cover"
                              />
                              <div className="absolute inset-0 bg-white/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-sm">
                                <div className="flex flex-col items-center gap-2">
                                  <Upload className="w-8 h-8 text-slate-900" />
                                  <span className="text-slate-900 font-black text-xs uppercase tracking-widest">Change Image</span>
                                </div>
                              </div>
                            </>
                          ) : (
                            <>
                              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                                <Upload className="w-8 h-8 text-primary" />
                              </div>
                              <div className="text-center">
                                <p className="font-black text-sm uppercase tracking-widest mb-1 text-slate-900">Upload Product Image</p>
                                <p className="text-xs text-muted-foreground">Drag and drop or click to browse</p>
                              </div>
                            </>
                          )}
                        </div>
                        <input 
                          type="file"
                          ref={fileInputRef}
                          className="hidden"
                          accept="image/*"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) setSelectedFile(file);
                          }}
                        />
                      </div>
                      {(selectedFile || productForm.image_url) && (
                        <div className="flex items-center justify-between px-2 pt-2">
                          <p className="text-[10px] font-bold text-muted-foreground italic">
                            {selectedFile ? `New file: ${selectedFile.name}` : 'Using existing URL'}
                          </p>
                          <button 
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedFile(null);
                              setProductForm({...productForm, image_url: ''});
                            }}
                            className="text-[10px] font-black uppercase text-red-500 hover:text-red-400 flex items-center gap-1"
                          >
                            <X className="w-3 h-3" /> Remove
                          </button>
                        </div>
                      )}
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Description Intelligence</label>
                      <textarea 
                        className="w-full bg-white border border-slate-200 rounded-2xl px-6 py-4 font-black outline-none focus:ring-2 focus:ring-primary min-h-[120px] resize-none text-slate-900" 
                        placeholder="Enter product details..." 
                        value={productForm.description}
                        onChange={(e) => setProductForm({...productForm, description: e.target.value})}
                      />
                    </div>
                  </form>
                )}

                {modalType === 'bulk-product' && (
                  <form id="bulkProductForm" onSubmit={handleBulkUpdate} className="space-y-6">
                    <div className="p-6 bg-primary/10 rounded-[2rem] border border-primary/20 mb-8">
                      <p className="text-sm font-bold text-primary mb-2">Bulk Operational Override</p>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        You are about to modify {selectedIds.length} records simultaneously. Only filled fields will be updated.
                      </p>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Category Override</label>
                      <div className="relative">
                        <select 
                          className="w-full bg-white border border-slate-200 rounded-2xl px-6 py-4 font-black outline-none focus:ring-2 focus:ring-primary appearance-none text-slate-900"
                          value={bulkEditForm.category}
                          onChange={(e) => setBulkEditForm({...bulkEditForm, category: e.target.value})}
                        >
                          <option value="">No Change</option>
                          {categories.map(cat => (
                            <option key={cat.id} value={cat.id}>{cat.name}</option>
                          ))}
                        </select>
                        <ChevronDown className="absolute right-6 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Price Adjustment</label>
                        <input 
                          type="number" 
                          className="w-full bg-white border border-slate-200 rounded-2xl px-6 py-4 font-black outline-none focus:ring-2 focus:ring-primary text-slate-900" 
                          placeholder="New Price..." 
                          value={bulkEditForm.price}
                          onChange={(e) => setBulkEditForm({...bulkEditForm, price: e.target.value})}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Stock Level</label>
                        <input 
                          type="number" 
                          className="w-full bg-white border border-slate-200 rounded-2xl px-6 py-4 font-black outline-none focus:ring-2 focus:ring-primary text-slate-900" 
                          placeholder="New Quantity..." 
                          value={bulkEditForm.stock_quantity}
                          onChange={(e) => setBulkEditForm({...bulkEditForm, stock_quantity: e.target.value})}
                        />
                      </div>
                    </div>
                  </form>
                )}

                {modalType === 'promo' && (
                  <form id="promoForm" onSubmit={(e) => { e.preventDefault(); handleGenericSave('promos', promoForm); }} className="space-y-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Promo Code Signature</label>
                      <input 
                        type="text" 
                        required
                        className="w-full bg-white border border-slate-200 rounded-2xl px-6 py-4 font-black outline-none focus:ring-primary uppercase text-slate-900" 
                        placeholder="e.g. READMART50" 
                        value={promoForm.code}
                        onChange={(e) => setPromoForm({...promoForm, code: e.target.value.toUpperCase()})}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Discount Type</label>
                        <div className="relative">
                          <select 
                            className="w-full bg-white border border-slate-200 rounded-2xl px-6 py-4 font-black outline-none appearance-none focus:ring-2 focus:ring-primary text-slate-900"
                            value={promoForm.discount_type}
                            onChange={(e) => setPromoForm({...promoForm, discount_type: e.target.value})}
                          >
                            <option value="percentage">Percentage (%)</option>
                            <option value="fixed">Fixed Amount</option>
                          </select>
                          <ChevronDown className="absolute right-6 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Value</label>
                        <input 
                          type="number" 
                          required
                          className="w-full bg-white border border-slate-200 rounded-2xl px-6 py-4 font-black outline-none focus:ring-2 focus:ring-primary text-slate-900" 
                          placeholder="0" 
                          value={promoForm.discount_value}
                          onChange={(e) => setPromoForm({...promoForm, discount_value: Number(e.target.value)})}
                        />
                      </div>
                    </div>
                  </form>
                )}

                {modalType === 'shipping' && (
                  <form id="shippingForm" onSubmit={(e) => { e.preventDefault(); handleGenericSave('shipping_zones', shippingForm); }} className="space-y-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Region Name</label>
                      <input 
                        type="text" 
                        required
                        className="w-full bg-white border border-slate-200 rounded-2xl px-6 py-4 font-black outline-none text-slate-900" 
                        placeholder="e.g. Nairobi Central" 
                        value={shippingForm.name}
                        onChange={(e) => setShippingForm({...shippingForm, name: e.target.value})}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Base Delivery Rate</label>
                      <input 
                        type="number" 
                        required
                        className="w-full bg-white border border-slate-200 rounded-2xl px-6 py-4 font-black outline-none text-slate-900" 
                        placeholder="0.00" 
                        value={shippingForm.base_rate}
                        onChange={(e) => setShippingForm({...shippingForm, base_rate: Number(e.target.value)})}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Description</label>
                      <textarea 
                        className="w-full bg-white border border-slate-200 rounded-2xl px-6 py-4 font-black outline-none min-h-[100px] text-slate-900" 
                        placeholder="Regional delivery details..." 
                        value={shippingForm.description}
                        onChange={(e) => setShippingForm({...shippingForm, description: e.target.value})}
                      />
                    </div>
                  </form>
                )}

                {modalType === 'user' && (
                   <form id="userForm" onSubmit={(e) => { e.preventDefault(); handleGenericSave('profiles', userForm); }} className="space-y-6">
                     <div className="space-y-2">
                       <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Full Name</label>
                       <input 
                         type="text" 
                         required
                         className="w-full bg-white border border-slate-200 rounded-2xl px-6 py-4 font-black outline-none text-slate-900" 
                         placeholder="John Doe" 
                         value={userForm.full_name}
                         onChange={(e) => setUserForm({...userForm, full_name: e.target.value})}
                       />
                     </div>
                     <div className="space-y-2">
                       <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Email Address</label>
                       <input 
                         type="email" 
                         required
                         className="w-full bg-white border border-slate-200 rounded-2xl px-6 py-4 font-black outline-none text-slate-900" 
                         placeholder="user@readmart.com" 
                         value={userForm.email}
                         onChange={(e) => setUserForm({...userForm, email: e.target.value})}
                       />
                     </div>
                     <div className="space-y-2">
                       <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Assign Role</label>
                       <div className="relative">
                         <select 
                           className="w-full bg-white border border-slate-200 rounded-2xl px-6 py-4 font-black outline-none appearance-none focus:ring-2 focus:ring-primary text-slate-900"
                           value={userForm.role}
                           onChange={(e) => setUserForm({...userForm, role: e.target.value})}
                         >
                           <option value="customer">Standard Citizen</option>
                           <option value="author">Authorized Author</option>
                           <option value="partner">Strategic Partner</option>
                           <option value="manager">Ops Manager</option>
                           <option value="admin">System Admin</option>
                         </select>
                         <ChevronDown className="absolute right-6 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                       </div>
                     </div>
                   </form>
                 )}

                 {modalType === 'banner' && (
                   <form id="bannerForm" onSubmit={(e) => { e.preventDefault(); handleGenericSave('cms_content', bannerForm); }} className="space-y-6">
                     <div className="space-y-2">
                       <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Banner Title</label>
                       <input 
                         type="text" 
                         required
                         className="w-full bg-white border border-slate-200 rounded-2xl px-6 py-4 font-black outline-none text-slate-900" 
                         placeholder="Campaign Title" 
                         value={bannerForm.title}
                         onChange={(e) => setBannerForm({...bannerForm, title: e.target.value})}
                       />
                     </div>
                     <div className="space-y-2">
                       <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Content/Description</label>
                       <textarea 
                         className="w-full bg-white border border-slate-200 rounded-2xl px-6 py-4 font-black outline-none min-h-[100px] text-slate-900" 
                         placeholder="Campaign details..." 
                         value={bannerForm.content}
                         onChange={(e) => setBannerForm({...bannerForm, content: e.target.value})}
                       />
                     </div>
                     <div className="space-y-2">
                       <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Image Source (URL)</label>
                       <input 
                         type="url" 
                         required
                         className="w-full bg-white border border-slate-200 rounded-2xl px-6 py-4 font-black outline-none text-slate-900" 
                         placeholder="https://..." 
                         value={bannerForm.image_url}
                         onChange={(e) => setBannerForm({...bannerForm, image_url: e.target.value})}
                       />
                     </div>
                   </form>
                 )}

                 {modalType === 'event' && (
                   <form id="eventForm" onSubmit={(e) => { e.preventDefault(); handleGenericSave('cms_content', { ...eventForm, type: 'event', is_active: true }); }} className="space-y-6">
                     <div className="space-y-2">
                       <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Event Designation</label>
                       <input 
                         type="text" 
                         required
                         className="w-full bg-white border border-slate-200 rounded-2xl px-6 py-4 font-black outline-none text-slate-900" 
                         placeholder="e.g. Writers Workshop 2026" 
                         value={eventForm.title}
                         onChange={(e) => setEventForm({...eventForm, title: e.target.value})}
                       />
                     </div>
                     <div className="grid grid-cols-2 gap-6">
                       <div className="space-y-2">
                         <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Temporal Data (Date)</label>
                         <input 
                           type="date" 
                           required
                           className="w-full bg-white border border-slate-200 rounded-2xl px-6 py-4 font-black outline-none text-slate-900" 
                           value={eventForm.published_at}
                           onChange={(e) => setEventForm({...eventForm, published_at: e.target.value})}
                         />
                       </div>
                       <div className="space-y-2">
                         <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Location Node</label>
                         <input 
                           type="text" 
                           required
                           className="w-full bg-white border border-slate-200 rounded-2xl px-6 py-4 font-black outline-none text-slate-900" 
                           placeholder="ReadMart Hub / Zoom" 
                           value={eventForm.metadata.location}
                           onChange={(e) => setEventForm({...eventForm, metadata: { ...eventForm.metadata, location: e.target.value }})}
                         />
                       </div>
                     </div>
                   </form>
                 )}

                 {modalType === 'club' && (
                   <form id="clubForm" onSubmit={(e) => { e.preventDefault(); handleGenericSave('book_clubs', clubForm); }} className="space-y-6">
                     <div className="space-y-2">
                       <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Hub Identity (Name)</label>
                       <input 
                         type="text" 
                         required
                         className="w-full bg-white border border-slate-200 rounded-2xl px-6 py-4 font-black outline-none text-slate-900" 
                         placeholder="The Philosophy Circle" 
                         value={clubForm.title}
                         onChange={(e) => setClubForm({...clubForm, title: e.target.value})}
                       />
                     </div>
                     <div className="space-y-2">
                       <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Operational Mandate</label>
                       <textarea 
                         className="w-full bg-white border border-slate-200 rounded-2xl px-6 py-4 font-black outline-none min-h-[100px] resize-none text-slate-900" 
                         placeholder="Club mission and vision..." 
                         value={clubForm.description}
                         onChange={(e) => setClubForm({...clubForm, description: e.target.value})}
                       />
                     </div>
                   </form>
                 )}

                 {modalType === 'team' && (
                   <form id="teamForm" onSubmit={(e) => { e.preventDefault(); handleGenericSave('profiles', teamForm); }} className="space-y-6">
                     <div className="space-y-2">
                       <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Full Legal Name</label>
                       <input 
                         type="text" 
                         required
                         className="w-full bg-white border border-slate-200 rounded-2xl px-6 py-4 font-black outline-none text-slate-900" 
                         placeholder="Enter name..." 
                         value={teamForm.full_name}
                         onChange={(e) => setTeamForm({...teamForm, full_name: e.target.value})}
                       />
                     </div>
                     <div className="space-y-2">
                       <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Corporate Email</label>
                       <input 
                         type="email" 
                         required
                         className="w-full bg-white border border-slate-200 rounded-2xl px-6 py-4 font-black outline-none text-slate-900" 
                         placeholder="name@readmart.com" 
                         value={teamForm.email}
                         onChange={(e) => setTeamForm({...teamForm, email: e.target.value})}
                       />
                     </div>
                     <div className="space-y-2">
                       <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Command Role</label>
                       <div className="relative">
                         <select 
                           className="w-full bg-white border border-slate-200 rounded-2xl px-6 py-4 font-black outline-none appearance-none focus:ring-2 focus:ring-primary text-slate-900"
                           value={teamForm.role}
                           onChange={(e) => setTeamForm({...teamForm, role: e.target.value})}
                         >
                           <option value="manager">Ops Manager</option>
                           <option value="admin">System Admin</option>
                           <option value="founder">Co-Founder</option>
                         </select>
                         <ChevronDown className="absolute right-6 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                       </div>
                     </div>
                   </form>
                 )}
              </div>

              <div className="flex gap-4 mt-10">
                <button 
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-5 glass rounded-[2rem] font-black uppercase tracking-widest text-xs hover:bg-slate-100 transition-all border-slate-200 text-slate-600 bg-white"
                >
                  Abort Protocol
                </button>
                <button 
                  type="submit"
                  form={`${modalType.includes('-') ? modalType.split('-')[0] + modalType.split('-')[1].charAt(0).toUpperCase() + modalType.split('-')[1].slice(1) : modalType}Form`}
                  className="flex-[2] py-5 bg-primary text-white rounded-[2rem] font-black uppercase tracking-widest text-xs shadow-xl shadow-primary/20 hover:scale-[1.02] transition-all"
                >
                  {isLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : `Commit ${modalType.replace('-', ' ')}`}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </div>
    </div>
  );
}

// Missing icon from lucide-react
const MapPin = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
  </svg>
);
