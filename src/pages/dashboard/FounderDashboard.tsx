import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect, useMemo } from 'react';
import { 
  LayoutDashboard, Package, ShoppingCart, Users, 
  Settings, Image as ImageIcon, Truck, MessageSquare, 
  Users2, Calendar, FileText, Tag, Loader2, Plus, 
  Search, Edit, Trash2, Mail, Eye, CreditCard,
  CheckCircle, XCircle, AlertCircle, Sparkles,
  RefreshCw, Shield, Globe, Bell, DollarSign,
  TrendingUp, BarChart2, Briefcase, UserPlus,
  Clock, MapPin, FileUp, Download, Filter,
  ChevronLeft, ChevronRight, CheckSquare, Square,
  HelpCircle, Zap, Database, ChevronUp, Handshake
} from 'lucide-react';
import { 
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area, PieChart, Pie, Cell
} from 'recharts';
import { toast } from 'sonner';
import { supabase, type RealtimeChannel } from '@/lib/supabase/client';
import { useCurrency } from '@/contexts/CurrencyContext';
import { 
  getGlobalAnalytics, getInventory, getOrders, getAllUsers, 
  getSiteSettings, updateSiteSettings, getInquiries, 
  getPartnerships, getAuthors, getApprovedAuthors, updateProduct, deleteProduct,
  createProduct, updateOrderStatus, updateUserStatus, updateApplicationStatus,
  getCategories, getShippingZones, getPromos, togglePromoStatus,
  initializeCampaign, getPromoMetrics, getPromoAuditLogs, calculateImpact,
  getClubs, createBookClub, updateBookClub,
  getEvents, createEvent, updateEvent,
  getBanners, createBanner, updateBanner,
  getAnnouncements, createAnnouncement, updateAnnouncement,
  sendAbandonedCartReminders, updateRecord, createRecord,
  getProtocolAgreements, createProtocolAgreement, updateProtocolAgreement, deleteProtocolAgreement,
  deleteRecord, getAllPayouts, disbursePayouts, getNotificationLogs
} from '@/api/dashboards';
import { uploadSiteAsset, uploadProductImage, uploadEbookFile, uploadAgreementFile } from '@/api/storage';
import { getEventRSVPs } from '@/api/community';
import FounderPartnerships from './FounderPartnerships';
import { 
  getNewsletterSubscriptions, 
  updateNewsletterStatus,
  batchUpdateNewsletterStatus,
  type NewsletterStatus 
} from '@/api/newsletter';

interface DashboardData {
  analytics: any;
  inventory: any[];
  orders: any[];
  users: any[];
  settings: Record<string, any>;
  inquiries: any[];
  partnerships: any[];
  authors: any[];
  approvedAuthors: any[];
  categories: any[];
  shippingZones: any[];
  promos: any[];
  clubs: any[];
  events: any[];
  banners: any[];
  announcements: any[];
  newsletterSubscriptions: any[];
  protocols: any[];
  payouts: any[];
  notificationLogs: any[];
}

export default function FounderDashboard() {
  const { formatPrice } = useCurrency();
  const [activeTab, setActiveTab] = useState('analytics');
  const [isLoading, setIsLoading] = useState(true);
  const [data, setData] = useState<DashboardData>({
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
    clubs: [],
    events: [],
    banners: [],
    announcements: [],
    newsletterSubscriptions: [],
    protocols: [],
    payouts: [],
    notificationLogs: []
  });

  const [isDisbursing, setIsDisbursing] = useState(false);

  const handleDisburse = async () => {
    if (!confirm('Are you sure you want to trigger disbursements for all pending payouts?')) return;
    
    setIsDisbursing(true);
    try {
      const result = await disbursePayouts();
      toast.success(`Disbursement initiated for ${result.results?.length || 0} payouts`);
      fetchAllData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to trigger disbursements');
    } finally {
      setIsDisbursing(false);
    }
  };

  // Fetch all required data
  
  useEffect(() => {
    fetchAllData();

    // Set up Realtime synchronization for critical tables
    // Consolidated into fewer channels for better stability
    
    const setupSubscriptions = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      // 1. Core Data
      const coreChannel = supabase
        .channel('founder_dashboard_core')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => fetchAllData())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, () => fetchAllData())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => fetchAllData())
        .subscribe((status: string) => {
          if (status === 'CHANNEL_ERROR') {
            console.warn('Realtime Error (Core): Failed to subscribe to orders/products/profiles');
          }
        });

      // 2. Content Data
      const contentChannel = supabase
        .channel('founder_dashboard_content')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'book_clubs' }, () => fetchAllData())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'events' }, () => fetchAllData())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'banners' }, () => fetchAllData())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'announcements' }, () => fetchAllData())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'shipping_zones' }, () => fetchAllData())
        .subscribe((status: string) => {
          if (status === 'CHANNEL_ERROR') {
            console.warn('Realtime Error (Content): Failed to subscribe to content tables');
          }
        });

      // 3. Applications & Agreements
      const appsChannel = supabase
        .channel('founder_dashboard_apps')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'author_applications' }, () => fetchAllData())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'partnership_applications' }, () => fetchAllData())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'partnership_agreements' }, () => fetchAllData())
        .subscribe((status: string) => {
          if (status === 'CHANNEL_ERROR') {
            console.warn('Realtime Error (Apps): Failed to subscribe to applications/agreements');
          }
        });

      // 4. Communications & Subscriptions
      const commsChannel = supabase
        .channel('founder_dashboard_comms')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'contact_messages' }, () => fetchAllData())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'newsletter_subscriptions' }, () => fetchAllData())
        .subscribe((status: string) => {
          if (status === 'CHANNEL_ERROR') {
            console.warn('Realtime Error (Comms): Failed to subscribe to messages/subscriptions');
          }
        });

      return [coreChannel, contentChannel, appsChannel, commsChannel];
    };

    let channels: RealtimeChannel[] = [];
    setupSubscriptions().then(subs => {
      if (subs) channels = subs;
    });

    return () => {
      channels.forEach(ch => supabase.removeChannel(ch));
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
        getClubs(),
        getEvents(),
        getBanners(),
        getAnnouncements(),
        getNewsletterSubscriptions(),
        getProtocolAgreements(),
        getAllPayouts(),
        getNotificationLogs()
      ]);

      const [
        analytics, inventory, orders, users, 
        settings, inquiries, partnerships, 
        authors, approvedAuthors, categories, shippingZones, promos,
        clubs, events, banners, announcements,
        newsletterSubscriptions, protocols, payouts, notificationLogs
      ] = results.map(res => res.status === 'fulfilled' ? res.value : null);

      setData({ 
        analytics: analytics || { 
          totalRevenue: 0, 
          totalOrders: 0, 
          totalUsers: 0, 
          totalProducts: 0, 
          revenueTrend: '0%',
          ordersTrend: '0%',
          usersTrend: '0%',
          productsTrend: '0%',
          salesData: [], 
          categoryStats: [] 
        },
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
        clubs: clubs || [],
        events: events || [],
        banners: banners || [],
        announcements: announcements || [],
        newsletterSubscriptions: newsletterSubscriptions || [],
        protocols: protocols || [],
        payouts: payouts || [],
        notificationLogs: notificationLogs || []
      });

      if (results.some(res => res.status === 'rejected')) {
        const failedIndices = results
          .map((res, i) => res.status === 'rejected' ? i : -1)
          .filter(i => i !== -1);
        
        const functionNames = [
          'getGlobalAnalytics', 'getInventory', 'getOrders', 'getAllUsers', 
          'getSiteSettings', 'getInquiries', 'getPartnerships', 'getAuthors', 
          'getApprovedAuthors', 'getCategories', 'getShippingZones', 'getPromos',
          'getClubs', 'getEvents', 'getBanners', 'getAnnouncements',
          'getNewsletterSubscriptions', 'getProtocolAgreements', 'getAllPayouts', 'getNotificationLogs'
        ];

        failedIndices.forEach(idx => {
          const res = results[idx] as PromiseRejectedResult;
          console.error(`Dashboard fetch failed for ${functionNames[idx]}:`, res.reason);
        });

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
    { id: 'comms', label: 'Communications', icon: Bell },
    { id: 'partnerships', label: 'Partnerships', icon: Handshake },
    { id: 'payouts', label: 'Payouts', icon: CreditCard },
  ];

  const renderActiveTab = () => {
    switch (activeTab) {
      case 'analytics': return <AnalyticsView data={data.analytics} formatPrice={formatPrice} />;
      case 'inventory': return (
        <InventoryView 
          data={data.inventory} 
          categories={data.categories} 
          approvedAuthors={data.approvedAuthors}
          onUpdate={fetchAllData} 
        />
      );
      case 'orders': return <OrdersView data={data.orders} formatPrice={formatPrice} onUpdate={fetchAllData} />;
      case 'users': return <UsersView data={data.users} onUpdate={fetchAllData} />;
      case 'settings': return <SettingsView settings={data.settings} onUpdate={fetchAllData} />;
      case 'identity': return <IdentityView settings={data.settings} onUpdate={fetchAllData} />;
      case 'banners': return <BannersView settings={data.settings} banners={data.banners} announcements={data.announcements} onUpdate={fetchAllData} />;
      case 'author_of_day': return (
        <AuthorOfDayView 
          settings={data.settings} 
          authors={data.approvedAuthors}
          inventory={data.inventory}
          onUpdate={fetchAllData} 
        />
      );
      case 'shipping': return <ShippingView data={data.shippingZones} onUpdate={fetchAllData} formatPrice={formatPrice} />;
      case 'areas': return (
        <AreasView 
          data={data.shippingZones} 
          onUpdate={fetchAllData} 
          formatPrice={formatPrice}
        />
      );
      case 'inquiries': return <InquiriesView data={data.inquiries} onUpdate={fetchAllData} />;
      case 'clubs': return (
        <ClubsView 
          data={data.clubs || []} 
          onUpdate={fetchAllData} 
        />
      );
      case 'events': return (
        <EventsView 
          data={data.events || []} 
          onUpdate={fetchAllData} 
        />
      );
      case 'agreements': return (
        <AgreementsView 
          partnerships={data.partnerships} 
          authors={data.authors} 
          protocols={data.protocols}
          onUpdate={fetchAllData} 
        />
      );
      case 'promos': return <PromosView data={data.promos} onUpdate={fetchAllData} />;
      case 'newsletter': return <NewsletterView data={data.newsletterSubscriptions} onUpdate={fetchAllData} />;
      case 'comms': return <CommunicationsView logs={data.notificationLogs} users={data.users} onUpdate={fetchAllData} />;
      case 'partnerships': return <FounderPartnerships />;
      case 'payouts': return (
        <PayoutsView 
          data={data.payouts} 
          onUpdate={fetchAllData} 
          isDisbursing={isDisbursing}
          onDisburse={handleDisburse}
          formatPrice={formatPrice}
        />
      );
      default: return null;
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

        <div className="p-4 border-t border-slate-100 space-y-2">
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
            className="w-full"
          >
            {renderActiveTab()}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}

function CommunicationsView({ logs, users, onUpdate }: any) {
  const [isSending, setIsSending] = useState(false);
  const [recipient, setRecipient] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [useTemplate, setUseTemplate] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showUserList, setShowUserList] = useState(false);

  const filteredUsers = useMemo(() => {
    if (!searchQuery) return [];
    return users?.filter((u: any) => 
      u.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.full_name?.toLowerCase().includes(searchQuery.toLowerCase())
    ).slice(0, 5);
  }, [users, searchQuery]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recipient || !subject || !message) {
      toast.error('Please fill in all fields');
      return;
    }

    setIsSending(true);
    try {
      const { sendCustomEmail } = await import('@/api/dashboards');
      await sendCustomEmail({
        to: recipient,
        subject,
        message,
        useTemplate
      });
      toast.success('Email sent successfully');
      setRecipient('');
      setSubject('');
      setMessage('');
      onUpdate?.();
    } catch (error: any) {
      toast.error(error.message || 'Failed to send email');
    } finally {
      setIsSending(false);
    }
  };

  const selectUser = (user: any) => {
    setRecipient(user.email);
    setSearchQuery('');
    setShowUserList(false);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* Composer */}
      <div className="lg:col-span-2 space-y-8">
        <div>
          <h1 className="text-4xl font-black tracking-tighter uppercase mb-2">Communications Protocol</h1>
          <p className="text-slate-500 font-medium">Draft and dispatch system-wide intelligence</p>
        </div>

        <div className="bg-white rounded-[40px] border border-slate-100 shadow-sm overflow-hidden p-8">
          <form onSubmit={handleSend} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2 relative">
                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-2">Recipient</label>
                <div className="relative">
                  <Users className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    value={recipient || searchQuery}
                    onChange={(e) => {
                      if (recipient) setRecipient('');
                      setSearchQuery(e.target.value);
                      setShowUserList(true);
                    }}
                    onFocus={() => setShowUserList(true)}
                    placeholder="Search users or enter email..."
                    className="w-full pl-12 pr-4 py-3 bg-slate-50 border-none rounded-2xl text-sm focus:ring-2 focus:ring-primary/20 transition-all"
                  />
                </div>
                
                {showUserList && filteredUsers.length > 0 && (
                  <div className="absolute z-10 w-full mt-2 bg-white border border-slate-100 rounded-2xl shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-2">
                    {filteredUsers.map((user: any) => (
                      <button
                        key={user.id}
                        type="button"
                        onClick={() => selectUser(user)}
                        className="w-full flex items-center gap-3 p-4 hover:bg-slate-50 transition-colors text-left border-b border-slate-50 last:border-none"
                      >
                        <div className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center text-[10px] font-black uppercase">
                          {user.full_name?.charAt(0) || user.email?.charAt(0)}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-900">{user.full_name || 'Anonymous User'}</p>
                          <p className="text-[10px] text-slate-400 font-medium">{user.email}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-2">Subject</label>
                <div className="relative">
                  <FileText className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="Enter subject line"
                    className="w-full pl-12 pr-4 py-3 bg-slate-50 border-none rounded-2xl text-sm focus:ring-2 focus:ring-primary/20 transition-all"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center mb-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-2">Message Body</label>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setMessage(m => m + '**Bold Text**')} className="p-1.5 bg-slate-50 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-900 transition-all"><span className="text-xs font-bold">B</span></button>
                  <button type="button" onClick={() => setMessage(m => m + '*Italic Text*')} className="p-1.5 bg-slate-50 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-900 transition-all"><span className="text-xs italic font-serif">I</span></button>
                  <button type="button" onClick={() => setMessage(m => m + '\n- List Item')} className="p-1.5 bg-slate-50 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-900 transition-all"><Filter className="w-3 h-3" /></button>
                </div>
              </div>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={8}
                placeholder="Compose your message here... (Markdown supported)"
                className="w-full px-6 py-4 bg-slate-50 border-none rounded-3xl text-sm focus:ring-2 focus:ring-primary/20 transition-all resize-none font-mono"
              />
            </div>

            <div className="flex items-center justify-between">
              <label className="flex items-center gap-3 cursor-pointer group">
                <div className="relative">
                  <input
                    type="checkbox"
                    checked={useTemplate}
                    onChange={(e) => setUseTemplate(e.target.checked)}
                    className="sr-only"
                  />
                  <div className={`w-10 h-6 rounded-full transition-colors ${useTemplate ? 'bg-primary' : 'bg-slate-200'}`} />
                  <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${useTemplate ? 'translate-x-4' : ''}`} />
                </div>
                <span className="text-xs font-bold text-slate-500 group-hover:text-slate-900 transition-colors">Apply Branded Template</span>
              </label>

              <button
                type="submit"
                disabled={isSending}
                className="flex items-center gap-2 bg-primary text-white px-8 py-3 rounded-2xl font-bold text-sm hover:shadow-lg hover:shadow-primary/20 transition-all disabled:opacity-50"
              >
                {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                Dispatch Communication
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Logs */}
      <div className="space-y-8">
        <div>
          <h2 className="text-2xl font-black tracking-tighter uppercase mb-2">Transmission Log</h2>
          <p className="text-slate-500 font-medium">Recent delivery statuses</p>
        </div>

        <div className="bg-white rounded-[40px] border border-slate-100 shadow-sm overflow-hidden p-6 max-h-[700px] overflow-y-auto custom-scrollbar">
          <div className="space-y-4">
            {logs?.map((log: any) => (
              <div key={log.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 group hover:border-primary/20 transition-all">
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${
                      log.status === 'sent' ? 'bg-green-500' : 
                      log.status === 'failed' ? 'bg-red-500' : 'bg-amber-500'
                    }`} />
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{log.status}</span>
                  </div>
                  <span className="text-[10px] font-bold text-slate-300">{new Date(log.created_at).toLocaleDateString()}</span>
                </div>
                <p className="font-bold text-sm text-slate-900 line-clamp-1">{log.subject}</p>
                <p className="text-xs text-slate-500 mt-1 line-clamp-1">{log.recipient}</p>
              </div>
            ))}
            {(!logs || logs.length === 0) && (
              <div className="text-center py-12 text-slate-400 font-bold uppercase text-[10px] tracking-widest">
                No transmissions recorded
              </div>
            )}
          </div>
        </div>
      </div>
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
      const url = await uploadSiteAsset(file, { path: 'author_of_day' } as any);
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
    if (isEnabled) {
      if (!selectedAuthorId) {
        toast.error('Please select an author');
        return;
      }
      if (selectedBooks.length < 3) {
        toast.error('Please select at least 3 books to feature (max 5)');
        return;
      }
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
              <label htmlFor="enableFeature" className="relative inline-flex items-center cursor-pointer">
                <input 
                  id="enableFeature"
                  name="enableFeature"
                  type="checkbox" 
                  checked={isEnabled}
                  onChange={(e) => setIsEnabled(e.target.checked)}
                  className="sr-only peer" 
                />
                <div className="w-14 h-7 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[4px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-primary"></div>
              </label>
            </div>

            <div className="space-y-4">
              <label htmlFor="authorSelect" className="block text-sm font-bold text-slate-700">Select Author</label>
              <select 
                id="authorSelect"
                name="authorSelect"
                value={selectedAuthorId}
                onChange={handleAuthorChange}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-primary/20 font-bold transition-all text-sm"
              >
                <option value="">Select an Author</option>
                {authors.map((author: any) => (
                  <option key={author.id} value={author.id}>{author.full_name} ({author.email})</option>
                ))}
              </select>
            </div>

            <div className="space-y-4">
              <label htmlFor="featureImageUpload" className="block text-sm font-bold text-slate-700">Custom Feature Image (Optional)</label>
              <div className="flex items-center gap-4">
                {customImage && (
                  <div className="w-20 h-20 rounded-xl overflow-hidden border border-slate-200">
                    <img src={customImage} alt="Feature" className="w-full h-full object-cover" />
                  </div>
                )}
                <label htmlFor="featureImageUpload" className="flex-1 cursor-pointer group">
                  <div className="flex items-center justify-center gap-2 w-full h-20 border-2 border-dashed border-slate-200 rounded-xl text-slate-400 group-hover:border-primary/50 group-hover:text-primary transition-all">
                    {isUploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <ImageIcon className="w-5 h-5" />}
                    <span className="text-sm font-bold">{isUploading ? 'Uploading...' : 'Upload Image'}</span>
                  </div>
                  <input id="featureImageUpload" name="featureImageUpload" type="file" className="hidden" accept="image/*" onChange={handleImageUpload} disabled={isUploading} />
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
  const [isMounted, setIsMounted] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    setIsMounted(true);
    return () => setIsMounted(false);
  }, []);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [dateRange, setDateRange] = useState({ start: '', end: '' });

  // Filter logic
  const filteredData = useMemo(() => {
    return data.filter((sub: any) => {
      const matchesSearch = sub.email?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === 'all' || sub.status === statusFilter;
      const matchesDate = (!dateRange.start || new Date(sub.created_at) >= new Date(dateRange.start)) &&
                         (!dateRange.end || new Date(sub.created_at) <= new Date(dateRange.end));
      return matchesSearch && matchesStatus && matchesDate;
    });
  }, [data, searchTerm, statusFilter, dateRange]);

  // Pagination logic
  const [isSyncing, setIsSyncing] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  // Sync to Steme System
  const handleStemeSync = async () => {
    setIsSyncing(true);
    const loadingToast = toast.loading('Synchronizing with Steme Newsletter Ecosystem...');
    try {
      // Simulate API call to Steme
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // In a real scenario, this would call an endpoint like /api/steme/sync
      // For now we log it to our audit logs
      const { data: { session } } = await supabase.auth.getSession();
      await supabase.from('newsletter_logs').insert([{
        action: 'steme_sync',
        metadata: { 
          subscriber_count: data.length, 
          synced_by: session?.user?.email,
          timestamp: new Date().toISOString()
        }
      }]);

      toast.success(`Successfully synchronized ${data.length} subscribers to Steme`, { id: loadingToast });
      onUpdate();
    } catch (error) {
      toast.error('Steme synchronization failed', { id: loadingToast });
    } finally {
      setIsSyncing(false);
    }
  };

  const totalPages = Math.ceil(filteredData.length / itemsPerPage);
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredData.slice(start, start + itemsPerPage);
  }, [filteredData, currentPage, itemsPerPage]);

  const handleToggleStatus = async (id: string, currentStatus: string) => {
    // Only use statuses supported by current DB constraint
    const statuses: NewsletterStatus[] = ['active', 'unsubscribed'];
    const currentIndex = statuses.indexOf(currentStatus as any);
    const nextStatus = statuses[(currentIndex + 1) % statuses.length];
    
    const loadingToast = toast.loading(`Transitioning status to ${nextStatus}...`);
    try {
      await updateNewsletterStatus(id, nextStatus);
      toast.success(`Status updated to ${nextStatus}`, { id: loadingToast });
      onUpdate();
    } catch (error: any) {
      console.error('Status update failed:', error);
      // If it's a constraint error, we might have tried a status that's not allowed yet
      if (error.code === '23514' || error.message?.includes('check constraint')) {
        toast.error(`Status "${nextStatus}" is not supported by your current database schema.`, { id: loadingToast });
      } else {
        toast.error('Status transition failed', { id: loadingToast });
      }
    }
  };

  const handleBatchAction = async (action: NewsletterStatus) => {
    if (selectedIds.length === 0) return;
    const loadingToast = toast.loading(`Performing batch ${action}...`);
    try {
      await batchUpdateNewsletterStatus(selectedIds, action);
      toast.success(`Batch ${action} completed for ${selectedIds.length} subscribers`, { id: loadingToast });
      setSelectedIds([]);
      onUpdate();
    } catch (error) {
      toast.error('Batch operation failed', { id: loadingToast });
    }
  };

  const handleExport = (format: 'csv' | 'json' | 'txt') => {
    try {
      const exportData = filteredData.map((sub: any) => ({
        email: sub.email,
        status: sub.status,
        joined: new Date(sub.created_at).toLocaleString(),
        source: sub.source || 'website',
        last_updated: sub.updated_at ? new Date(sub.updated_at).toLocaleString() : 'N/A'
      }));

      let content = '';
      let filename = `readmart_subscribers_${new Date().toISOString().split('T')[0]}`;
      let mimeType = 'text/plain';

      if (format === 'json') {
        content = JSON.stringify(exportData, null, 2);
        filename += '.json';
        mimeType = 'application/json';
      } else if (format === 'csv') {
        const headers = ['Email', 'Status', 'Joined Date', 'Source', 'Last Updated'];
        const rows = exportData.map((d: any) => [
          d.email, 
          d.status, 
          `"${d.joined}"`, 
          d.source, 
          `"${d.last_updated}"`
        ]);
        content = [headers, ...rows].map(row => row.join(',')).join('\n');
        // Add BOM for Excel UTF-8 compatibility
        content = '\ufeff' + content;
        filename += '.csv';
        mimeType = 'text/csv;charset=utf-8;';
      } else {
        content = exportData.map((d: any) => d.email).join('\n');
        filename += '.txt';
      }

      const blob = new Blob([content], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success(`Exported ${filteredData.length} records as ${format.toUpperCase()}`);
    } catch (error) {
      console.error('Export failed:', error);
      toast.error('Export failed');
    } finally {
      // Done
    }
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === paginatedData.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(paginatedData.map((d: any) => d.id));
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  return (
    <div className="space-y-8">
      {/* Header Section */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
        <div>
          <h1 className="text-4xl font-black tracking-tighter uppercase mb-2 flex items-center gap-3">
            <Mail className="w-10 h-10 text-primary" />
            Newsletter Intelligence
          </h1>
          <p className="text-slate-500 font-medium">Managing {data.length} subscribers in the Steme ecosystem</p>
        </div>
        
        <div className="flex flex-wrap gap-3">
          <button 
            onClick={() => setShowHelp(!showHelp)}
            className="bg-white border border-slate-200 text-slate-600 px-6 py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-50 transition-all flex items-center gap-2 shadow-sm"
          >
            <HelpCircle className="w-4 h-4" />
            System Manual
          </button>
          
          <button 
            onClick={handleStemeSync}
            disabled={isSyncing}
            className="bg-primary text-white px-6 py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:opacity-90 transition-all flex items-center gap-2 shadow-xl shadow-primary/20 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
            Sync to Steme
          </button>

          <div className="relative group">
            <button className="bg-slate-900 text-white px-6 py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-800 transition-all flex items-center gap-2 shadow-xl shadow-slate-900/20">
              <Download className="w-4 h-4" />
              Export Protocol
            </button>
            <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-2xl shadow-2xl border border-slate-100 py-2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
              <button onClick={() => handleExport('csv')} className="w-full text-left px-6 py-3 text-sm font-bold text-slate-600 hover:bg-slate-50 hover:text-primary transition-all">Export as CSV (Excel)</button>
              <button onClick={() => handleExport('json')} className="w-full text-left px-6 py-3 text-sm font-bold text-slate-600 hover:bg-slate-50 hover:text-primary transition-all">Export as JSON</button>
              <button onClick={() => handleExport('txt')} className="w-full text-left px-6 py-3 text-sm font-bold text-slate-600 hover:bg-slate-50 hover:text-primary transition-all">Export Email List (TXT)</button>
            </div>
          </div>
        </div>
      </div>

      {/* System Manual / Help Section */}
      <AnimatePresence>
        {isMounted && showHelp && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="bg-slate-900 text-white p-10 rounded-[40px] shadow-2xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-64 h-64 bg-primary/20 blur-[100px] -mr-32 -mt-32" />
              <div className="relative z-10 grid md:grid-cols-3 gap-10">
                <div className="space-y-4">
                  <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center">
                    <Shield className="w-6 h-6 text-primary" />
                  </div>
                  <h3 className="text-xl font-black uppercase tracking-tighter">Subscriber Lifecycle</h3>
                  <p className="text-slate-400 text-sm font-medium leading-relaxed">
                    Subscribers are automatically marked as <span className="text-white font-bold italic">active</span> upon signup. You can manually transition them to <span className="text-white font-bold italic">unsubscribed</span> if they request removal or bounce.
                  </p>
                </div>
                <div className="space-y-4">
                  <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center">
                    <Zap className="w-6 h-6 text-primary" />
                  </div>
                  <h3 className="text-xl font-black uppercase tracking-tighter">Steme Integration</h3>
                  <p className="text-slate-400 text-sm font-medium leading-relaxed">
                    The <span className="text-white font-bold italic">Steme Ecosystem</span> sync ensures your subscriber data is available for targeted campaigns. Use the <span className="text-white font-bold italic">Sync</span> button to manually push local updates.
                  </p>
                </div>
                <div className="space-y-4">
                  <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center">
                    <Database className="w-6 h-6 text-primary" />
                  </div>
                  <h3 className="text-xl font-black uppercase tracking-tighter">Data Security</h3>
                  <p className="text-slate-400 text-sm font-medium leading-relaxed">
                    All subscriber data is encrypted and protected by Row-Level Security (RLS). Only <span className="text-white font-bold italic">Founders</span> and <span className="text-white font-bold italic">Admins</span> can access these records.
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setShowHelp(false)}
                className="mt-10 text-xs font-black uppercase tracking-widest text-primary hover:text-white transition-colors flex items-center gap-2"
              >
                Dismiss Protocol Manual <ChevronUp className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Control Panel */}
      <div className="grid lg:grid-cols-4 gap-4">
        <div className="lg:col-span-2 relative">
          <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300" />
          <input 
            type="text" 
            placeholder="Fuzzy search by email or domain..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-14 pr-6 py-5 bg-white border border-slate-100 rounded-[24px] outline-none focus:ring-4 focus:ring-primary/10 font-bold transition-all text-sm shadow-sm"
          />
        </div>
        <div className="relative">
          <Filter className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300" />
          <select 
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full pl-14 pr-6 py-5 bg-white border border-slate-100 rounded-[24px] outline-none focus:ring-4 focus:ring-primary/10 font-bold transition-all text-sm shadow-sm appearance-none"
          >
            <option value="all">All Status Protocol</option>
            <option value="active">Active (Synced)</option>
            <option value="unsubscribed">Unsubscribed</option>
          </select>
        </div>
        <div className="flex gap-2">
          <input 
            type="date"
            value={dateRange.start}
            onChange={(e) => setDateRange({...dateRange, start: e.target.value})}
            className="flex-1 px-4 py-5 bg-white border border-slate-100 rounded-[24px] outline-none focus:ring-4 focus:ring-primary/10 font-bold transition-all text-xs shadow-sm"
          />
          <input 
            type="date"
            value={dateRange.end}
            onChange={(e) => setDateRange({...dateRange, end: e.target.value})}
            className="flex-1 px-4 py-5 bg-white border border-slate-100 rounded-[24px] outline-none focus:ring-4 focus:ring-primary/10 font-bold transition-all text-xs shadow-sm"
          />
        </div>
      </div>

      {/* Batch Operations */}
      <AnimatePresence>
        {isMounted && selectedIds.length > 0 && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="bg-primary p-4 rounded-2xl flex items-center justify-between shadow-xl shadow-primary/20"
          >
            <div className="flex items-center gap-4 text-white">
              <div className="bg-white/20 p-2 rounded-xl">
                <CheckSquare className="w-5 h-5" />
              </div>
              <p className="font-bold text-sm">{selectedIds.length} subscribers selected for protocol update</p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => handleBatchAction('active')} className="px-4 py-2 bg-white text-primary rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-50 transition-all">Activate</button>
              <button onClick={() => handleBatchAction('unsubscribed')} className="px-4 py-2 bg-white/20 text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-white/30 transition-all">Unsubscribe</button>
              <button onClick={() => setSelectedIds([])} className="px-4 py-2 text-white/60 font-bold text-[10px] uppercase tracking-widest hover:text-white transition-all">Cancel</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Data Table */}
      <div className="bg-white rounded-[40px] border border-slate-100 shadow-sm overflow-hidden relative">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-slate-50/50">
                <th className="px-8 py-6 text-left">
                  <button onClick={toggleSelectAll} className="p-1 hover:bg-slate-100 rounded-md transition-all">
                    {selectedIds.length === paginatedData.length && paginatedData.length > 0 ? (
                      <CheckSquare className="w-5 h-5 text-primary" />
                    ) : (
                      <Square className="w-5 h-5 text-slate-300" />
                    )}
                  </button>
                </th>
                <th className="px-4 py-6 text-left text-[10px] font-black uppercase tracking-widest text-slate-400">Subscriber Identity</th>
                <th className="px-8 py-6 text-left text-[10px] font-black uppercase tracking-widest text-slate-400">Temporal Node (Joined)</th>
                <th className="px-8 py-6 text-left text-[10px] font-black uppercase tracking-widest text-slate-400">Operational Status</th>
                <th className="px-8 py-6 text-right text-[10px] font-black uppercase tracking-widest text-slate-400">Protocols</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {paginatedData.map((sub: any) => (
                <tr key={sub.id} className={`hover:bg-slate-50/30 transition-all group ${selectedIds.includes(sub.id) ? 'bg-primary/5' : ''}`}>
                  <td className="px-8 py-6">
                    <button onClick={() => toggleSelect(sub.id)} className="p-1 rounded-md transition-all">
                      {selectedIds.includes(sub.id) ? (
                        <CheckSquare className="w-5 h-5 text-primary" />
                      ) : (
                        <Square className="w-5 h-5 text-slate-200 group-hover:text-slate-300" />
                      )}
                    </button>
                  </td>
                  <td className="px-4 py-6">
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${
                        sub.status === 'active' ? 'bg-green-50 text-green-500' : 
                        'bg-slate-100 text-slate-400'
                      }`}>
                        <Mail className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="font-black text-slate-900 group-hover:text-primary transition-colors">{sub.email}</p>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Source: {sub.source || 'website_portal'}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-6">
                    <div className="flex items-center gap-2 text-slate-500">
                      <Clock className="w-4 h-4" />
                      <span className="font-bold text-sm">{new Date(sub.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}</span>
                    </div>
                  </td>
                  <td className="px-8 py-6">
                    <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-tighter ${
                      sub.status === 'active' ? 'bg-green-100 text-green-600' : 
                      sub.status === 'unsubscribed' ? 'bg-red-100 text-red-600' :
                      'bg-slate-100 text-slate-500'
                    }`}>
                      {sub.status || 'Active'}
                    </span>
                  </td>
                  <td className="px-8 py-6 text-right">
                    <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all">
                      <button 
                        onClick={() => handleToggleStatus(sub.id, sub.status)}
                        className="p-3 bg-white border border-slate-100 text-slate-600 rounded-xl hover:bg-primary hover:text-white hover:border-primary transition-all shadow-sm"
                        title="Transition Status"
                      >
                        <RefreshCw className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredData.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-8 py-32 text-center">
                    <div className="max-w-xs mx-auto">
                      <div className="w-20 h-20 bg-slate-50 rounded-[32px] flex items-center justify-center mx-auto mb-6">
                        <Mail className="w-10 h-10 text-slate-200" />
                      </div>
                      <h3 className="font-black uppercase tracking-tighter text-slate-900 text-lg mb-2">No Signal Detected</h3>
                      <p className="text-slate-400 text-sm font-bold mb-8">No subscribers matching your current search parameters were found in the database.</p>
                      <button 
                        onClick={() => {setSearchTerm(''); setStatusFilter('all'); setDateRange({start: '', end: ''})}}
                        className="text-primary font-black text-xs uppercase tracking-widest hover:underline"
                      >
                        Reset All Filters
                      </button>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {filteredData.length > 0 && (
          <div className="p-8 border-t border-slate-50 flex items-center justify-between bg-slate-50/30">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
              Showing <span className="text-slate-900">{Math.min(filteredData.length, (currentPage-1)*itemsPerPage + 1)}-{Math.min(filteredData.length, currentPage*itemsPerPage)}</span> of <span className="text-slate-900">{filteredData.length}</span> entities
            </p>
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-2 rounded-xl bg-white border border-slate-200 text-slate-400 disabled:opacity-30 hover:bg-primary hover:text-white transition-all shadow-sm"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              {[...Array(totalPages)].map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrentPage(i + 1)}
                  className={`w-10 h-10 rounded-xl font-black text-xs transition-all ${
                    currentPage === i + 1 
                      ? 'bg-primary text-white shadow-lg shadow-primary/20' 
                      : 'bg-white border border-slate-200 text-slate-400 hover:bg-slate-50'
                  }`}
                >
                  {i + 1}
                </button>
              ))}
              <button 
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="p-2 rounded-xl bg-white border border-slate-200 text-slate-400 disabled:opacity-30 hover:bg-primary hover:text-white transition-all shadow-sm"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// --- Payouts View ---
function PayoutsView({ data, isDisbursing, onDisburse, formatPrice }: any) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const itemsPerPage = 10;

  const filteredData = useMemo(() => {
    return data.filter((p: any) => {
      const matchesSearch = 
        p.partner_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.order_id?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === 'all' || p.payout_status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [data, searchTerm, statusFilter]);

  const currentItems = filteredData.slice(0, itemsPerPage);

  const pendingAmount = data
    .filter((p: any) => p.payout_status === 'pending')
    .reduce((acc: number, p: any) => acc + Number(p.amount), 0);

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-4xl font-black tracking-tighter uppercase mb-2">Payout Management</h1>
          <p className="text-slate-500 font-medium">Global royalty & commission disbursements</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right px-6 py-3 bg-white rounded-2xl border border-slate-100 shadow-sm">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Pending Total</p>
            <p className="text-xl font-black text-primary">{formatPrice(pendingAmount)}</p>
          </div>
          <button
            onClick={onDisburse}
            disabled={isDisbursing || pendingAmount === 0}
            className="h-14 px-8 bg-primary text-white rounded-2xl font-black uppercase tracking-widest text-xs flex items-center gap-3 hover:scale-105 active:scale-95 transition-all shadow-xl shadow-primary/20 disabled:opacity-50 disabled:scale-100"
          >
            {isDisbursing ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Zap className="w-5 h-5" />
            )}
            {isDisbursing ? 'Processing...' : 'Trigger Disbursements'}
          </button>
        </div>
      </div>

      <div className="bg-white rounded-[40px] border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-8 border-b border-slate-50 flex flex-wrap items-center justify-between gap-6 bg-slate-50/30">
          <div className="flex-1 min-w-[300px] relative group">
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-primary transition-colors" />
            <input 
              type="text" 
              placeholder="Search by Partner ID or Order ID..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-14 pr-6 py-4 bg-white border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-primary/10 font-bold text-sm transition-all"
            />
          </div>
          
          <div className="flex items-center gap-3">
            <Filter className="w-5 h-5 text-slate-400" />
            <div className="flex bg-white p-1.5 rounded-2xl border border-slate-200 shadow-inner">
              {['all', 'pending', 'processing', 'paid', 'failed'].map((status) => (
                <button
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                    statusFilter === status 
                    ? 'bg-primary text-white shadow-lg shadow-primary/20' 
                    : 'text-slate-400 hover:text-slate-900'
                  }`}
                >
                  {status}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-50">
                <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest text-slate-400">Partner & Type</th>
                <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest text-slate-400">Order Context</th>
                <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest text-slate-400">Amount</th>
                <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest text-slate-400">Status</th>
                <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest text-slate-400">Timeline</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {currentItems.map((p: any) => (
                <tr key={p.id} className="group hover:bg-slate-50/50 transition-colors">
                  <td className="px-8 py-6">
                    <div>
                      <p className="font-black text-sm text-slate-900 truncate max-w-[150px]">{p.partner_id}</p>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{p.type}</p>
                    </div>
                  </td>
                  <td className="px-8 py-6">
                    <div>
                      <p className="font-bold text-sm text-slate-600">Order #{p.order_id?.slice(-8)}</p>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Commission: {p.commission_rate}%</p>
                    </div>
                  </td>
                  <td className="px-8 py-6">
                    <span className="font-black text-sm text-slate-900">{formatPrice(p.amount)}</span>
                  </td>
                  <td className="px-8 py-6">
                    <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-tighter ${
                      p.payout_status === 'paid' ? 'bg-green-100 text-green-600' : 
                      p.payout_status === 'processing' ? 'bg-blue-100 text-blue-600' :
                      p.payout_status === 'failed' ? 'bg-red-100 text-red-600' :
                      'bg-orange-100 text-orange-600'
                    }`}>
                      {p.payout_status}
                    </span>
                  </td>
                  <td className="px-8 py-6">
                    <div className="flex items-center gap-2 text-slate-500">
                      <Clock className="w-4 h-4" />
                      <span className="font-bold text-sm">{new Date(p.created_at).toLocaleDateString()}</span>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredData.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-8 py-32 text-center">
                    <div className="max-w-xs mx-auto">
                      <div className="w-20 h-20 bg-slate-50 rounded-[32px] flex items-center justify-center mx-auto mb-6">
                        <CreditCard className="w-10 h-10 text-slate-200" />
                      </div>
                      <h3 className="font-black uppercase tracking-tighter text-slate-900 text-lg mb-2">No Payouts Found</h3>
                      <p className="text-slate-400 text-sm font-bold">No payout records match your filters.</p>
                    </div>
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
  if (!data) return (
    <div className="flex items-center justify-center h-[400px] bg-slate-50 rounded-[40px] border border-dashed border-slate-200">
      <div className="text-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-4" />
        <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Initialising Analytics Engine...</p>
      </div>
    </div>
  );

  const [shouldRenderChart, setShouldRenderChart] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setShouldRenderChart(true), 500);
    return () => clearTimeout(timer);
  }, []);

  const safeTrend = (trend: any) => {
    if (typeof trend !== 'string') return '0%';
    return trend || '0%';
  };

  const stats = [
    { label: 'Total Revenue', value: formatPrice(data.totalRevenue || 0), trend: safeTrend(data.revenueTrend), icon: DollarSign, color: 'bg-green-500' },
    { label: 'Total Orders', value: data.totalOrders || 0, trend: safeTrend(data.ordersTrend), icon: ShoppingCart, color: 'bg-blue-500' },
    { label: 'Total Users', value: data.totalUsers || 0, trend: safeTrend(data.usersTrend), icon: Users, color: 'bg-purple-500' },
    { label: 'Total Products', value: data.totalProducts || 0, trend: safeTrend(data.productsTrend), icon: Package, color: 'bg-orange-500' },
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
          <div className="h-[400px] min-h-[400px] w-full relative">
            {shouldRenderChart && (
              <ResponsiveContainer width="100%" height="100%" minWidth={0}>
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
            )}
          </div>
        </div>

        <div className="bg-white p-10 rounded-[40px] border border-slate-100 shadow-sm">
          <h3 className="text-xl font-black tracking-tighter uppercase mb-10">Category Saturation</h3>
          <div className="h-[400px] min-h-[400px] w-full relative">
            {shouldRenderChart && (
              <ResponsiveContainer width="100%" height="100%" minWidth={0}>
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
            )}
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
  const [isMounted, setIsMounted] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);

  useEffect(() => {
    setIsMounted(true);
    return () => setIsMounted(false);
  }, []);
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
    console.log('[InventoryView] Starting image upload for:', file.name);

    try {
      const url = await uploadProductImage(file, {
        onProgress: (progress) => {
          const percent = Math.round((progress.loaded / progress.total) * 100);
          console.log(`[InventoryView] Upload progress: ${percent}%`);
          setUploadProgress(prev => ({ ...prev, cover: percent }));
        }
      });
      console.log('[InventoryView] Upload successful, URL:', url);
      setFormData(prev => ({ ...prev, image_url: url }));
      toast.success('Imagery synchronized', { id: loadingToast });
      setTimeout(() => setUploadProgress(prev => ({ ...prev, cover: 0 })), 2000);
    } catch (error: any) {
      console.error('[InventoryView] Upload failed:', error);
      toast.error(`Upload failed: ${error.message || 'Unknown error'}`, { id: loadingToast });
    }
  };

  const handleEbookUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const loadingToast = toast.loading('Uploading secure digital asset...');
    console.log('[InventoryView] Starting ebook upload for:', file.name);

    try {
      const identifier = editingItem?.id || `temp_${Date.now()}`;
      const path = await uploadEbookFile(file, identifier, {
        onProgress: (progress) => {
          const percent = Math.round((progress.loaded / progress.total) * 100);
          console.log(`[InventoryView] Ebook progress: ${percent}%`);
          setUploadProgress(prev => ({ ...prev, ebook: percent }));
        }
      });
      console.log('[InventoryView] Ebook upload successful, path:', path);
      setFormData(prev => ({ ...prev, ebook_url: path }));
      toast.success('Digital asset synchronized', { id: loadingToast });
      setTimeout(() => setUploadProgress(prev => ({ ...prev, ebook: 0 })), 2000);
    } catch (error: any) {
      console.error('[InventoryView] Ebook upload failed:', error);
      toast.error(`Upload failed: ${error.message || 'Unknown error'}`, { id: loadingToast });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const loadingToast = toast.loading(editingItem ? 'Updating Asset...' : 'Registering Asset...');
    console.log('[InventoryView] Submitting form data:', formData);

    try {
      // Destructure to remove fields that don't belong in the products table
      const { is_ebook, ebook_url, type, author, ...rawFormData } = formData;

      const productPayload = {
        ...rawFormData,
        price: parseFloat(formData.price.toString()) || 0,
        sale_price: formData.sale_price ? parseFloat(formData.sale_price.toString()) : null,
        stock_quantity: parseInt(formData.stock_quantity.toString()) || 0,
        category_id: formData.category_id || null,
        author_id: formData.author_id || null,
        weight: parseFloat(formData.weight.toString()) || 0.5,
        volume: parseFloat(formData.volume.toString()) || 0.001,
        is_ebook: formData.type === 'ebook',
        ebook_url: formData.ebook_url, 
        ebook_metadata: formData.type === 'ebook' ? {
          file_path: formData.ebook_url,
          format: 'pdf',
        } : null
      };

      console.log('[InventoryView] Sending payload to API:', productPayload);

      if (editingItem) {
        await updateProduct(editingItem.id, productPayload);
        toast.success('Asset updated', { id: loadingToast });
      } else {
        const result = await createProduct(productPayload);
        console.log('[InventoryView] Registration successful:', result);
        toast.success('Asset registered', { id: loadingToast });
      }
      setIsModalOpen(false);
      onUpdate();
    } catch (error: any) {
      console.error('[InventoryView] Operation failed:', error);
      toast.error(`Operation failed: ${error.message || 'Unknown error'}`, { id: loadingToast });
    }
  };

  const handleToggleStatus = async (id: string, currentActive: boolean) => {
    const loadingToast = toast.loading(currentActive ? 'Deactivating campaign...' : 'Activating campaign...');
    try {
      await togglePromoStatus(id, !currentActive);
      toast.success(`Campaign ${currentActive ? 'Deactivated' : 'Activated'}`, { id: loadingToast });
      onUpdate();
    } catch (error) {
      toast.error('Toggle failed', { id: loadingToast });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to decommission this asset?')) return;
    const loadingToast = toast.loading('Decommissioning Asset...');
    try {
      await deleteProduct(id);
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
                    <button 
                      onClick={() => handleToggleStatus(item.id, item.is_active)}
                      className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter transition-all hover:opacity-80 ${
                        item.is_active ? 'bg-green-100 text-green-600' : 'bg-slate-100 text-slate-400'
                      }`}
                    >
                      {item.is_active ? 'Active' : 'Draft'}
                    </button>
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
        {isMounted && isModalOpen && (
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
                      <label htmlFor="assetTitle" className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Asset Title</label>
                      <input 
                        id="assetTitle"
                        name="assetTitle"
                        required
                        type="text" 
                        value={formData.title}
                        onChange={(e) => setFormData({...formData, title: e.target.value})}
                        className="w-full px-6 py-4 bg-slate-50 rounded-2xl border-none outline-none focus:ring-2 focus:ring-primary/20 font-bold" 
                      />
                    </div>
                    <div>
                      <label htmlFor="author_id" className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Primary Author/Creator</label>
                      {approvedAuthors?.length > 0 ? (
                        <select 
                          id="author_id"
                          name="author_id"
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
                          id="author"
                          name="author"
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
                        <label htmlFor="price" className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Standard Value (KES)</label>
                        <input 
                          id="price"
                          name="price"
                          required
                          type="number" 
                          value={formData.price}
                          onChange={(e) => setFormData({...formData, price: e.target.value})}
                          className="w-full px-6 py-4 bg-slate-50 rounded-2xl border-none outline-none focus:ring-2 focus:ring-primary/20 font-bold" 
                          placeholder="0.00"
                        />
                        <p className="mt-1 text-[9px] text-slate-400 font-medium">Base acquisition cost within the ecosystem.</p>
                      </div>
                      <div>
                        <label htmlFor="sale_price" className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Impact Value (Optional)</label>
                        <input 
                          id="sale_price"
                          name="sale_price"
                          type="number" 
                          value={formData.sale_price}
                          onChange={(e) => setFormData({...formData, sale_price: e.target.value})}
                          className="w-full px-6 py-4 bg-slate-50 rounded-2xl border-none outline-none focus:ring-2 focus:ring-primary/20 font-bold" 
                          placeholder="0.00"
                        />
                        <p className="mt-1 text-[9px] text-slate-400 font-medium">Promotional or subsidized impact pricing.</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label htmlFor="stock_quantity" className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Resource Quantity</label>
                        <input 
                          id="stock_quantity"
                          name="stock_quantity"
                          required
                          type="number" 
                          value={formData.stock_quantity}
                          onChange={(e) => setFormData({...formData, stock_quantity: e.target.value})}
                          className="w-full px-6 py-4 bg-slate-50 rounded-2xl border-none outline-none focus:ring-2 focus:ring-primary/20 font-bold" 
                        />
                        <p className="mt-1 text-[9px] text-slate-400 font-medium">Available units for distribution protocol.</p>
                      </div>
                      <div>
                        <label htmlFor="assetType" className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Asset Type</label>
                        <select 
                          id="assetType"
                          name="assetType"
                          value={formData.type}
                          onChange={(e) => setFormData({...formData, type: e.target.value, is_ebook: e.target.value === 'ebook'})}
                          className="w-full px-6 py-4 bg-slate-50 rounded-2xl border-none outline-none focus:ring-2 focus:ring-primary/20 font-bold"
                        >
                          <option value="physical">Physical Manuscript</option>
                          <option value="ebook">Digital E-Book</option>
                        </select>
                        <p className="mt-1 text-[9px] text-slate-400 font-medium">Format of the registered protocol asset.</p>
                      </div>
                    </div>

                    {formData.type === 'physical' && (
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label htmlFor="weight" className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Weight (KG)</label>
                          <input 
                            id="weight"
                            name="weight"
                            type="number" 
                            step="0.001"
                            value={formData.weight}
                            onChange={(e) => setFormData({...formData, weight: e.target.value})}
                            className="w-full px-6 py-4 bg-slate-50 rounded-2xl border-none outline-none focus:ring-2 focus:ring-primary/20 font-bold" 
                          />
                        </div>
                        <div>
                          <label htmlFor="volume" className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Volume (m³)</label>
                          <input 
                            id="volume"
                            name="volume"
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
                            <label htmlFor="ebook_url" className="block text-[10px] font-black uppercase tracking-widest text-purple-300 mb-2">E-Book Secure Path / URL</label>
                            <div className="flex gap-2">
                              <input 
                                id="ebook_url"
                                name="ebook_url"
                                type="text" 
                                placeholder="Path in ebooks bucket..."
                                value={formData.ebook_url}
                                onChange={(e) => setFormData({...formData, ebook_url: e.target.value})}
                                className="flex-1 px-6 py-4 bg-white rounded-2xl border-none outline-none focus:ring-2 focus:ring-purple-200 font-bold text-purple-900" 
                              />
                              <div className="relative">
                                <label htmlFor="ebook-upload" className="cursor-pointer bg-purple-500 text-white p-4 rounded-2xl hover:bg-purple-600 transition-all shadow-lg shadow-purple-200 flex items-center justify-center">
                                  <FileUp className="w-6 h-6" />
                                  <input 
                                    id="ebook-upload"
                                    name="ebook-upload"
                                    type="file" 
                                    accept=".pdf" 
                                    onChange={handleEbookUpload} 
                                    className="hidden" 
                                  />
                                </label>
                                {uploadProgress.ebook > 0 && uploadProgress.ebook < 100 && (
                                  <>
                                    <div className="absolute -bottom-2 left-0 right-0 h-1 bg-purple-100 rounded-full overflow-hidden">
                                      <div 
                                        className="h-full bg-purple-500 transition-all duration-300"
                                        style={{ width: `${uploadProgress.ebook}%` }}
                                      />
                                    </div>
                                    <p className="absolute -top-6 left-1/2 -translate-x-1/2 text-[10px] font-black text-purple-500 whitespace-nowrap uppercase tracking-tighter">
                                      {uploadProgress.ebook}%
                                    </p>
                                  </>
                                )}
                              </div>
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
                      <label htmlFor="asset-upload-input" className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Asset Imagery</label>
                      <div className="aspect-[3/4] bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200 overflow-hidden relative group">
                        {formData.image_url ? (
                          <>
                            <img src={formData.image_url} alt="Preview" className="w-full h-full object-cover" />
                            <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center">
                              <label htmlFor="asset-upload" className="cursor-pointer bg-white text-slate-900 px-6 py-2 rounded-full font-black text-xs uppercase tracking-widest">
                                {uploadProgress.cover > 0 && uploadProgress.cover < 100 ? `Uploading (${uploadProgress.cover}%)...` : 'Change Image'}
                              </label>
                            </div>
                          </>
                        ) : (
                          <label htmlFor="asset-upload" className="absolute inset-0 flex flex-col items-center justify-center cursor-pointer hover:bg-slate-100 transition-all">
                            <ImageIcon className="w-12 h-12 text-slate-300 mb-2" />
                            <span className="font-bold text-xs text-slate-400 uppercase tracking-widest">
                          {uploadProgress.cover > 0 && uploadProgress.cover < 100 ? `Uploading (${uploadProgress.cover}%)...` : 'Upload Imagery'}
                        </span>
                      </label>
                    )}
                        {uploadProgress.cover > 0 && uploadProgress.cover < 100 && (
                          <div className="absolute bottom-0 left-0 right-0 h-1 bg-slate-100">
                            <div 
                              className="h-full bg-primary transition-all duration-300"
                              style={{ width: `${uploadProgress.cover}%` }}
                            />
                          </div>
                        )}
                        <input id="asset-upload" name="asset-upload" type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                      </div>
                    </div>
                    <div>
                      <label htmlFor="category_id" className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Classification</label>
                      <select 
                        id="category_id"
                        name="category_id"
                        required
                        value={formData.category_id}
                        onChange={(e) => setFormData({...formData, category_id: e.target.value})}
                        className="w-full px-6 py-4 bg-slate-50 rounded-2xl border-none outline-none focus:ring-2 focus:ring-primary/20 font-bold"
                      >
                        {categories.map((cat: any) => (
                          <option key={cat.id} value={cat.id}>{cat.name}</option>
                        ))}
                      </select>
                      <p className="mt-1 text-[9px] text-slate-400 font-medium">Define the asset's niche within the ecosystem.</p>
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
                      <p className="mt-1 text-[9px] text-slate-400 font-medium">
                        {formData.is_active 
                          ? 'Visible to public protocol participants.' 
                          : 'Restricted to internal ecosystem review.'}
                      </p>
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
                  <p className="mt-2 text-[10px] text-slate-400 font-medium italic">Provide the ecosystem with context regarding the impact of this protocol asset.</p>
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
  const [isMounted, setIsMounted] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);

  useEffect(() => {
    setIsMounted(true);
    return () => setIsMounted(false);
  }, []);
  
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
        {isMounted && selectedOrder && (
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
                <label htmlFor="tax_rate" className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Base Tax Rate (%)</label>
                <input 
                  id="tax_rate"
                  name="tax_rate"
                  type="number" 
                  value={formData.tax_rate}
                  onChange={(e) => setFormData({...formData, tax_rate: e.target.value})}
                  className="w-full px-6 py-4 bg-slate-50 rounded-2xl border-none outline-none focus:ring-2 focus:ring-primary/20 font-bold transition-all" 
                />
              </div>
              <div>
                <label htmlFor="default_currency" className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Default Currency</label>
                <select 
                  id="default_currency"
                  name="default_currency"
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
                <div id="announcement-status-label">
                  <p className="font-bold text-slate-900">Broadcasting Status</p>
                  <p className="text-xs text-slate-500 font-medium">Display a global notification to all users</p>
                </div>
                <button 
                  type="button"
                  aria-labelledby="announcement-status-label"
                  onClick={() => setFormData({...formData, announcement_active: !formData.announcement_active})}
                  className={`w-14 h-8 rounded-full transition-all relative ${formData.announcement_active ? 'bg-primary' : 'bg-slate-200'}`}
                >
                  <div className={`absolute top-1 w-6 h-6 bg-white rounded-full transition-all ${formData.announcement_active ? 'right-1' : 'left-1'}`} />
                </button>
              </div>
              <div>
                <label htmlFor="global_announcement" className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Announcement Payload</label>
                <textarea 
                  id="global_announcement"
                  name="global_announcement"
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
                <div id="maintenance-mode-label">
                  <p className="font-black text-red-600 uppercase tracking-tighter">Maintenance Mode</p>
                  <p className="text-xs text-red-500 font-bold">Suspend all customer operations immediately</p>
                </div>
                <button 
                  type="button"
                  aria-labelledby="maintenance-mode-label"
                  onClick={() => setFormData({...formData, maintenance_mode: !formData.maintenance_mode})}
                  className={`w-14 h-8 rounded-full transition-all relative ${formData.maintenance_mode ? 'bg-red-600' : 'bg-slate-200'}`}
                >
                  <div className={`absolute top-1 w-6 h-6 bg-white rounded-full transition-all ${formData.maintenance_mode ? 'right-1' : 'left-1'}`} />
                </button>
              </div>
              <div className="p-6 bg-slate-50 rounded-[32px] border border-slate-100">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4">Membership Payment Wall</p>
                <div className="flex items-center justify-between">
                  <div id="membership-wall-label">
                    <p className="font-bold text-slate-900">Gate exclusive content</p>
                    <p className="text-xs text-slate-500 font-medium">Enable/Disable membership paywall</p>
                  </div>
                  <button 
                    type="button"
                    aria-labelledby="membership-wall-label"
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
                  <label htmlFor="membership_price" className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Membership Price (KES)</label>
                  <input 
                    id="membership_price"
                    name="membership_price"
                    type="number" 
                    value={formData.membership_price}
                    onChange={(e) => setFormData({...formData, membership_price: e.target.value})}
                    className="w-full px-6 py-4 bg-slate-50 rounded-2xl border-none outline-none focus:ring-2 focus:ring-primary/20 font-bold transition-all" 
                  />
                </div>
                <div>
                  <label htmlFor="membership_duration_days" className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Duration (Days)</label>
                  <input 
                    id="membership_duration_days"
                    name="membership_duration_days"
                    type="number" 
                    value={formData.membership_duration_days}
                    onChange={(e) => setFormData({...formData, membership_duration_days: e.target.value})}
                    className="w-full px-6 py-4 bg-slate-50 rounded-2xl border-none outline-none focus:ring-2 focus:ring-primary/20 font-bold transition-all" 
                  />
                </div>
              </div>
              <div>
                <label htmlFor="membership_title" className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Wall Title</label>
                <input 
                  id="membership_title"
                  name="membership_title"
                  type="text" 
                  value={formData.membership_title}
                  onChange={(e) => setFormData({...formData, membership_title: e.target.value})}
                  className="w-full px-6 py-4 bg-slate-50 rounded-2xl border-none outline-none focus:ring-2 focus:ring-primary/20 font-bold transition-all" 
                />
              </div>
              <div>
                <label htmlFor="membership_description" className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Wall Description</label>
                <textarea 
                  id="membership_description"
                  name="membership_description"
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
  const [uploadProgress, setUploadProgress] = useState<{ [key: string]: number }>({});
  console.log('Upload progress:', uploadProgress); // Use it

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, field: string) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const loadingToast = toast.loading('Uploading asset...');
    try {
      const url = await uploadSiteAsset(file, {
        path: 'identity',
        onProgress: (progress) => {
          const percent = Math.round((progress.loaded / progress.total) * 100);
          setUploadProgress(prev => ({ ...prev, [field]: percent }));
        }
      });
      setFormData({ ...formData, [field]: url });
      toast.success('Asset uploaded successfully', { id: loadingToast });
      setTimeout(() => setUploadProgress(prev => ({ ...prev, [field]: 0 })), 2000);
    } catch (error) {
      toast.error('Upload failed', { id: loadingToast });
    } finally {
      setIsUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Simple URL validation for social links
    const socialFields = ['instagram_url', 'facebook_url', 'x_url', 'linkedin_url', 'tiktok_url', 'whatsapp_link'];
    const invalidFields = socialFields.filter(field => {
      const value = formData[field];
      if (value && value.trim() !== '') {
        try {
          new URL(value);
          return false;
        } catch (e) {
          return true;
        }
      }
      return false;
    });

    if (invalidFields.length > 0) {
      toast.error(`Invalid URL format in: ${invalidFields.map(f => f.replace('_url', '').replace('_link', '')).join(', ')}`);
      return;
    }

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
              <label htmlFor="logo-upload" className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Site Logo</label>
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
                      className="flex items-center justify-center gap-2 w-full px-6 py-4 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200 hover:border-primary/50 hover:bg-primary/5 cursor-pointer transition-all font-bold text-sm text-slate-500 relative overflow-hidden"
                    >
                      {uploadProgress.site_logo > 0 && uploadProgress.site_logo < 100 && (
                        <div 
                          className="absolute inset-0 bg-primary/10 transition-all duration-300" 
                          style={{ width: `${uploadProgress.site_logo}%` }}
                        />
                      )}
                      <ImageIcon className="w-5 h-5" />
                      {isUploading ? `Uploading (${uploadProgress.site_logo || 0}%)...` : 'Change Logo Asset'}
                    </label>
                </div>
              </div>
            </div>
            <div>
              <label htmlFor="site_name" className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Platform Name</label>
              <input 
                id="site_name"
                name="site_name"
                type="text" 
                value={formData.site_name}
                onChange={(e) => setFormData({...formData, site_name: e.target.value})}
                className="w-full px-6 py-4 bg-slate-50 rounded-2xl border-none outline-none focus:ring-2 focus:ring-primary/20 font-bold transition-all" 
              />
            </div>
            <div>
              <label htmlFor="contact_email" className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Support Email</label>
              <input 
                id="contact_email"
                name="contact_email"
                type="email" 
                value={formData.contact_email}
                onChange={(e) => setFormData({...formData, contact_email: e.target.value})}
                className="w-full px-6 py-4 bg-slate-50 rounded-2xl border-none outline-none focus:ring-2 focus:ring-primary/20 font-bold transition-all" 
                placeholder="hello@readmart.com"
              />
            </div>
            <div>
              <label htmlFor="contact_phone" className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Support Phone (Primary)</label>
              <input 
                id="contact_phone"
                name="contact_phone"
                type="text" 
                value={formData.contact_phone}
                onChange={(e) => setFormData({...formData, contact_phone: e.target.value})}
                className="w-full px-6 py-4 bg-slate-50 rounded-2xl border-none outline-none focus:ring-2 focus:ring-primary/20 font-bold transition-all" 
                placeholder="+254 794 129 958"
              />
            </div>
            <div>
              <label htmlFor="secondary_phone" className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Support Phone (Secondary)</label>
              <input 
                id="secondary_phone"
                name="secondary_phone"
                type="text" 
                value={formData.secondary_phone}
                onChange={(e) => setFormData({...formData, secondary_phone: e.target.value})}
                className="w-full px-6 py-4 bg-slate-50 rounded-2xl border-none outline-none focus:ring-2 focus:ring-primary/20 font-bold transition-all" 
                placeholder="+254 741 658 548"
              />
            </div>
            <div>
              <label htmlFor="whatsapp_link" className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Global Support WhatsApp</label>
              <input 
                id="whatsapp_link"
                name="whatsapp_link"
                type="text" 
                value={formData.whatsapp_link}
                onChange={(e) => setFormData({...formData, whatsapp_link: e.target.value})}
                className="w-full px-6 py-4 bg-slate-50 rounded-2xl border-none outline-none focus:ring-2 focus:ring-primary/20 font-bold transition-all" 
                placeholder="https://wa.me/254794129958"
              />
            </div>
            <div>
              <label htmlFor="address" className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Headquarters Address</label>
              <textarea 
                id="address"
                name="address"
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
              <label htmlFor="instagram_url" className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Instagram Intelligence</label>
              <input 
                id="instagram_url"
                name="instagram_url"
                type="text" 
                value={formData.instagram_url}
                onChange={(e) => setFormData({...formData, instagram_url: e.target.value})}
                className="w-full px-6 py-4 bg-slate-50 rounded-2xl border-none outline-none focus:ring-2 focus:ring-primary/20 font-bold transition-all" 
                placeholder="https://instagram.com/readmartke"
              />
            </div>
            <div>
              <label htmlFor="facebook_url" className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Facebook Node</label>
              <input 
                id="facebook_url"
                name="facebook_url"
                type="text" 
                value={formData.facebook_url}
                onChange={(e) => setFormData({...formData, facebook_url: e.target.value})}
                className="w-full px-6 py-4 bg-slate-50 rounded-2xl border-none outline-none focus:ring-2 focus:ring-primary/20 font-bold transition-all" 
                placeholder="https://facebook.com/readmartke"
              />
            </div>
            <div>
              <label htmlFor="x_url" className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">X (Twitter) Signal</label>
              <input 
                id="x_url"
                name="x_url"
                type="text" 
                value={formData.x_url}
                onChange={(e) => setFormData({...formData, x_url: e.target.value})}
                className="w-full px-6 py-4 bg-slate-50 rounded-2xl border-none outline-none focus:ring-2 focus:ring-primary/20 font-bold transition-all" 
                placeholder="https://x.com/readmartke"
              />
            </div>
            <div>
              <label htmlFor="linkedin_url" className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">LinkedIn Network</label>
              <input 
                id="linkedin_url"
                name="linkedin_url"
                type="text" 
                value={formData.linkedin_url}
                onChange={(e) => setFormData({...formData, linkedin_url: e.target.value})}
                className="w-full px-6 py-4 bg-slate-50 rounded-2xl border-none outline-none focus:ring-2 focus:ring-primary/20 font-bold transition-all" 
                placeholder="https://linkedin.com/company/readmartke"
              />
            </div>
            <div>
              <label htmlFor="tiktok_url" className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">TikTok Rhythm</label>
              <input 
                id="tiktok_url"
                name="tiktok_url"
                type="text" 
                value={formData.tiktok_url}
                onChange={(e) => setFormData({...formData, tiktok_url: e.target.value})}
                className="w-full px-6 py-4 bg-slate-50 rounded-2xl border-none outline-none focus:ring-2 focus:ring-primary/20 font-bold transition-all" 
                placeholder="https://tiktok.com/@readmartke"
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

function BannersView({ settings, banners, announcements, onUpdate }: any) {
  const [heroFormData, setHeroFormData] = useState(settings);
  const [isMounted, setIsMounted] = useState(false);
  const [isUploadingHero, setIsUploadingHero] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ [key: string]: number }>({});
  
  useEffect(() => {
    setIsMounted(true);
    return () => setIsMounted(false);
  }, []);

  // Promotional Banners State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBanner, setEditingBanner] = useState<any>(null);
  const [isUploadingBanner, setIsUploadingBanner] = useState(false);
  const [bannerFormData, setBannerFormData] = useState({
    title: '',
    content: '',
    image_url: '',
    link_url: '',
    is_active: true
  });

  // Announcements State
  const [isAnnouncementModalOpen, setIsAnnouncementModalOpen] = useState(false);
  const [editingAnnouncement, setEditingAnnouncement] = useState<any>(null);
  const [announcementFormData, setAnnouncementFormData] = useState({
    content: '',
    link_url: '',
    is_active: true,
    priority: 1
  });

  const handleHeroUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingHero(true);
    const loadingToast = toast.loading('Uploading hero asset...');
    try {
      const url = await uploadSiteAsset(file, {
        path: 'hero',
        onProgress: (progress) => {
          const percent = Math.round((progress.loaded / progress.total) * 100);
          setUploadProgress(prev => ({ ...prev, hero: percent }));
        }
      });
      setHeroFormData({ ...heroFormData, hero_image_url: url });
      toast.success('Hero imagery synchronized', { id: loadingToast });
      setTimeout(() => setUploadProgress(prev => ({ ...prev, hero: 0 })), 2000);
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
      const url = await uploadSiteAsset(file, {
        path: 'banners',
        onProgress: (progress) => {
          const percent = Math.round((progress.loaded / progress.total) * 100);
          setUploadProgress(prev => ({ ...prev, banner: percent }));
        }
      });
      setBannerFormData(prev => ({ ...prev, image_url: url }));
      toast.success('Banner asset synchronized', { id: loadingToast });
      setTimeout(() => setUploadProgress(prev => ({ ...prev, banner: 0 })), 2000);
    } catch (error) {
      toast.error('Upload failed', { id: loadingToast });
    } finally {
      setIsUploadingBanner(false);
    }
  };

  const handleEditBanner = (banner: any) => {
    setEditingBanner(banner);
    setBannerFormData({
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
      const payload = {
        ...bannerFormData,
        metadata: {
          updated_at: new Date().toISOString()
        }
      };

      if (editingBanner) {
        await updateBanner(editingBanner.id, payload);
        toast.success('Banner updated', { id: loadingToast });
      } else {
        await createBanner(payload);
        toast.success('Banner deployed', { id: loadingToast });
      }
      setIsModalOpen(false);
      onUpdate();
    } catch (error: any) {
      console.error('Banner error:', error);
      toast.error(`Operation failed: ${error.message || 'Check connectivity'}`, { id: loadingToast });
    }
  };

  const handleDeleteBanner = async (id: string) => {
    if (!confirm('Are you sure you want to decommission this banner?')) return;
    const loadingToast = toast.loading('Decommissioning Banner...');
    try {
      await deleteRecord('banners', id);
      toast.success('Banner decommissioned', { id: loadingToast });
      onUpdate();
    } catch (error) {
      toast.error('Failed to decommission', { id: loadingToast });
    }
  };

  const handleEditAnnouncement = (announcement: any) => {
    setEditingAnnouncement(announcement);
    setAnnouncementFormData({
      content: announcement.content,
      link_url: announcement.link_url || '',
      is_active: announcement.is_active ?? true,
      priority: announcement.priority || 1
    });
    setIsAnnouncementModalOpen(true);
  };

  const handleAddNewAnnouncement = () => {
    setEditingAnnouncement(null);
    setAnnouncementFormData({
      content: '',
      link_url: '',
      is_active: true,
      priority: 1
    });
    setIsAnnouncementModalOpen(true);
  };

  const handleAnnouncementSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const loadingToast = toast.loading(editingAnnouncement ? 'Updating Announcement...' : 'Deploying Announcement...');
    try {
      if (editingAnnouncement) {
        await updateAnnouncement(editingAnnouncement.id, announcementFormData);
        toast.success('Announcement updated', { id: loadingToast });
      } else {
        await createAnnouncement(announcementFormData);
        toast.success('Announcement deployed', { id: loadingToast });
      }
      setIsAnnouncementModalOpen(false);
      onUpdate();
    } catch (error: any) {
      console.error('Announcement error:', error);
      toast.error(`Operation failed: ${error.message || 'Check connectivity'}`, { id: loadingToast });
    }
  };

  const handleDeleteAnnouncement = async (id: string) => {
    if (!confirm('Are you sure you want to decommission this announcement?')) return;
    const loadingToast = toast.loading('Decommissioning Announcement...');
    try {
      await deleteRecord('announcements', id);
      toast.success('Announcement decommissioned', { id: loadingToast });
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
              <label htmlFor="hero_headline" className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Headline</label>
              <input 
                id="hero_headline"
                name="hero_headline"
                type="text" 
                value={heroFormData.hero_headline}
                onChange={(e) => setHeroFormData({...heroFormData, hero_headline: e.target.value})}
                className="w-full px-6 py-4 bg-slate-50 rounded-2xl border-none outline-none focus:ring-2 focus:ring-primary/20 font-bold transition-all text-xl" 
              />
            </div>
            <div>
              <label htmlFor="hero_subtext" className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Sub-Narrative</label>
              <textarea 
                id="hero_subtext"
                name="hero_subtext"
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
                className="flex items-center justify-center gap-2 w-full px-6 py-4 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200 hover:border-primary/50 hover:bg-primary/5 cursor-pointer transition-all font-bold text-sm text-slate-500 relative overflow-hidden"
              >
                {uploadProgress.hero > 0 && uploadProgress.hero < 100 && (
                  <div 
                    className="absolute bottom-0 left-0 h-1 bg-primary transition-all duration-300" 
                    style={{ width: `${uploadProgress.hero}%` }}
                  />
                )}
                <ImageIcon className="w-5 h-5" />
                {isUploadingHero ? `Uploading (${uploadProgress.hero}%)...` : 'Change Hero Narrative Imagery'}
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

          <div className="mt-12 pt-12 border-t border-slate-100">
             <div className="flex justify-between items-center mb-8">
               <h3 className="text-xl font-black tracking-tighter uppercase">Bar Announcements</h3>
               <button 
                onClick={handleAddNewAnnouncement}
                className="text-primary font-bold text-sm hover:underline flex items-center gap-1"
               >
                 <Plus className="w-4 h-4" />
                 Deploy New Broadcast
               </button>
             </div>

             <div className="space-y-4">
                {announcements.map((announcement: any) => (
                  <div key={announcement.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center gap-4 group">
                    <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center text-primary">
                      <Bell className="w-5 h-5" />
                    </div>
                    <div className="flex-1">
                      <p className="font-bold text-slate-900 text-sm line-clamp-1">{announcement.content}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-full ${announcement.is_active ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-200 text-slate-500'}`}>
                          {announcement.is_active ? 'Active' : 'Inactive'}
                        </span>
                        {announcement.priority > 1 && (
                          <span className="text-[8px] font-black uppercase px-2 py-0.5 rounded-full bg-amber-100 text-amber-600">
                            Priority {announcement.priority}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-all">
                      <button 
                        onClick={() => handleEditAnnouncement(announcement)}
                        className="p-2 bg-white text-slate-600 rounded-lg hover:bg-primary hover:text-white transition-all shadow-sm"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => handleDeleteAnnouncement(announcement.id)}
                        className="p-2 bg-white text-rose-500 rounded-lg hover:bg-rose-500 hover:text-white transition-all shadow-sm"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
                {announcements.length === 0 && (
                  <div className="p-8 border-2 border-dashed border-slate-200 rounded-[24px] flex flex-col items-center justify-center text-center">
                    <Bell className="w-8 h-8 text-slate-300 mb-2" />
                    <p className="font-black uppercase tracking-widest text-[10px] text-slate-400 mb-1">Global Site Broadcasts</p>
                    <button onClick={handleAddNewAnnouncement} className="text-primary font-bold text-xs hover:underline">Deploy New Broadcast</button>
                  </div>
                )}
             </div>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {isMounted && isModalOpen && (
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
                        <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-all flex flex-col items-center justify-center">
                          {uploadProgress.banner > 0 && uploadProgress.banner < 100 ? (
                            <div className="w-48 bg-white/20 h-2 rounded-full overflow-hidden mb-4">
                              <div className="bg-white h-full transition-all duration-300" style={{ width: `${uploadProgress.banner}%` }} />
                            </div>
                          ) : null}
                          <label htmlFor="banner-upload" className="cursor-pointer bg-white text-slate-900 px-6 py-2 rounded-full font-black text-xs uppercase tracking-widest">
                            {isUploadingBanner ? `Uploading (${uploadProgress.banner}%)...` : 'Replace Asset'}
                          </label>
                        </div>
                      </>
                    ) : (
                      <label htmlFor="banner-upload" className="absolute inset-0 flex flex-col items-center justify-center cursor-pointer hover:bg-slate-100 transition-all">
                        {uploadProgress.banner > 0 && uploadProgress.banner < 100 && (
                          <div className="absolute top-0 left-0 right-0 h-1 bg-primary transition-all duration-300" style={{ width: `${uploadProgress.banner}%` }} />
                        )}
                        <ImageIcon className="w-12 h-12 text-slate-300 mb-2" />
                        <span className="font-bold text-xs text-slate-400 uppercase tracking-widest">
                          {isUploadingBanner ? `Uploading (${uploadProgress.banner}%)...` : 'Upload Campaign Asset'}
                        </span>
                      </label>
                    )}
                    <input id="banner-upload" type="file" accept="image/*" onChange={handleBannerUpload} className="hidden" />
                  </div>
                </div>

                <div>
                  <label htmlFor="banner_title" className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Banner Title</label>
                  <input 
                    id="banner_title"
                    name="banner_title"
                    required
                    type="text" 
                    value={bannerFormData.title}
                    onChange={(e) => setBannerFormData({...bannerFormData, title: e.target.value})}
                    placeholder="e.g. Summer Reading Challenge"
                    className="w-full px-6 py-4 bg-slate-50 rounded-2xl border-none outline-none focus:ring-2 focus:ring-primary/20 font-bold" 
                  />
                </div>

                <div>
                  <label htmlFor="banner_content" className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Banner Content</label>
                  <textarea 
                    id="banner_content"
                    name="banner_content"
                    required
                    value={bannerFormData.content}
                    onChange={(e) => setBannerFormData({...bannerFormData, content: e.target.value})}
                    placeholder="Brief description of the promotion"
                    className="w-full px-6 py-4 bg-slate-50 rounded-2xl border-none outline-none focus:ring-2 focus:ring-primary/20 font-bold h-32 resize-none" 
                  />
                </div>

                <div>
                  <label htmlFor="banner_link_url" className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Link URL (Optional)</label>
                  <input 
                    id="banner_link_url"
                    name="banner_link_url"
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

        {isMounted && isAnnouncementModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAnnouncementModalOpen(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative bg-white w-full max-w-lg rounded-[40px] shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
            >
              <div className="p-8 border-b border-slate-50 flex justify-between items-center bg-slate-50/50">
                <div>
                  <h2 className="text-2xl font-black uppercase tracking-tighter">{editingAnnouncement ? 'Modify Broadcast' : 'Deploy Broadcast'}</h2>
                  <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Global Site Protocol</p>
                </div>
                <button onClick={() => setIsAnnouncementModalOpen(false)} className="p-2 hover:bg-white rounded-full transition-all">
                  <XCircle className="w-8 h-8 text-slate-300 hover:text-red-500" />
                </button>
              </div>

              <form onSubmit={handleAnnouncementSubmit} className="flex-1 overflow-y-auto p-10 space-y-6 custom-scrollbar">
                <div>
                  <label htmlFor="announcement_content" className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Announcement Content</label>
                  <textarea 
                    id="announcement_content"
                    name="announcement_content"
                    required
                    value={announcementFormData.content}
                    onChange={(e) => setAnnouncementFormData({...announcementFormData, content: e.target.value})}
                    placeholder="Broadcast message..."
                    className="w-full px-6 py-4 bg-slate-50 rounded-2xl border-none outline-none focus:ring-2 focus:ring-primary/20 font-bold h-32 resize-none" 
                  />
                </div>

                <div>
                  <label htmlFor="announcement_link" className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Link URL (Optional)</label>
                  <input 
                    id="announcement_link"
                    name="announcement_link"
                    type="text" 
                    value={announcementFormData.link_url}
                    onChange={(e) => setAnnouncementFormData({...announcementFormData, link_url: e.target.value})}
                    placeholder="https://..."
                    className="w-full px-6 py-4 bg-slate-50 rounded-2xl border-none outline-none focus:ring-2 focus:ring-primary/20 font-bold" 
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="announcement_priority" className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Priority Level</label>
                    <input 
                      id="announcement_priority"
                      name="announcement_priority"
                      type="number" 
                      min="1"
                      max="10"
                      value={announcementFormData.priority}
                      onChange={(e) => setAnnouncementFormData({...announcementFormData, priority: parseInt(e.target.value)})}
                      className="w-full px-6 py-4 bg-slate-50 rounded-2xl border-none outline-none focus:ring-2 focus:ring-primary/20 font-bold" 
                    />
                  </div>
                  <div className="flex flex-col justify-end pb-4">
                    <div className="flex items-center gap-3">
                      <input 
                        type="checkbox" 
                        id="announcement-active"
                        checked={announcementFormData.is_active}
                        onChange={(e) => setAnnouncementFormData({...announcementFormData, is_active: e.target.checked})}
                        className="w-5 h-5 rounded border-slate-300 text-primary focus:ring-primary"
                      />
                      <label htmlFor="announcement-active" className="text-sm font-bold text-slate-600">Active</label>
                    </div>
                  </div>
                </div>

                <button 
                  type="submit"
                  className="w-full bg-primary text-white py-6 rounded-[32px] font-black uppercase tracking-widest shadow-2xl shadow-primary/30 hover:scale-[1.02] active:scale-[0.98] transition-all"
                >
                  {editingAnnouncement ? 'Commit Changes' : 'Deploy Broadcast'}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ShippingView({ data, onUpdate, formatPrice }: any) {
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [editingZone, setEditingZone] = useState<any>(null);

  useEffect(() => {
    setIsMounted(true);
    return () => setIsMounted(false);
  }, []);
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
                  <td className="px-8 py-6 font-black text-primary">{formatPrice(zone.price || zone.rate || zone.base_rate || 0)}</td>
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
        {isMounted && isModalOpen && (
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
                    <label htmlFor="region_name" className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Region/Town Name</label>
                    <input 
                      id="region_name"
                      name="region_name"
                      required
                      type="text" 
                      value={formData.name}
                      onChange={(e) => setFormData({...formData, name: e.target.value})}
                      placeholder="e.g. Nairobi CBD, Mombasa, Kisumu"
                      className="w-full px-6 py-4 bg-slate-50 rounded-2xl border-none outline-none focus:ring-2 focus:ring-primary/20 font-bold" 
                    />
                  </div>

                  <div>
                    <label htmlFor="country_code" className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Country Code</label>
                    <input 
                      id="country_code"
                      name="country_code"
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
                    <label htmlFor="shipping_region" className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Region/Province</label>
                    <input 
                      id="shipping_region"
                      name="shipping_region"
                      type="text" 
                      value={formData.region}
                      onChange={(e) => setFormData({...formData, region: e.target.value})}
                      placeholder="e.g. Nairobi, Coast, Rift Valley"
                      className="w-full px-6 py-4 bg-slate-50 rounded-2xl border-none outline-none focus:ring-2 focus:ring-primary/20 font-bold" 
                    />
                  </div>

                  <div className="col-span-2">
                    <label htmlFor="postal_codes" className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Postal Codes (Comma separated)</label>
                    <input 
                      id="postal_codes"
                      name="postal_codes"
                      type="text" 
                      value={formData.postal_codes}
                      onChange={(e) => setFormData({...formData, postal_codes: e.target.value})}
                      placeholder="e.g. 00100, 00200 or 80100-80105"
                      className="w-full px-6 py-4 bg-slate-50 rounded-2xl border-none outline-none focus:ring-2 focus:ring-primary/20 font-bold" 
                    />
                  </div>

                  <div>
                    <label htmlFor="shipping_method" className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Shipping Method</label>
                    <select 
                      id="shipping_method"
                      name="shipping_method"
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
                    <label htmlFor="delivery_fee" className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Delivery Fee (KES)</label>
                    <input 
                      id="delivery_fee"
                      name="delivery_fee"
                      required
                      type="number" 
                      value={formData.price}
                      onChange={(e) => setFormData({...formData, price: e.target.value})}
                      placeholder="250"
                      className="w-full px-6 py-4 bg-slate-50 rounded-2xl border-none outline-none focus:ring-2 focus:ring-primary/20 font-bold" 
                    />
                  </div>

                  <div>
                    <label htmlFor="estimated_days" className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Estimated Days</label>
                    <input 
                      id="estimated_days"
                      name="estimated_days"
                      required
                      type="number" 
                      value={formData.estimated_days}
                      onChange={(e) => setFormData({...formData, estimated_days: e.target.value})}
                      placeholder="3"
                      className="w-full px-6 py-4 bg-slate-50 rounded-2xl border-none outline-none focus:ring-2 focus:ring-primary/20 font-bold" 
                    />
                  </div>

                  <div>
                    <label id="regional-status-label" className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Regional Status</label>
                    <button
                      type="button"
                      aria-labelledby="regional-status-label"
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
  const [isMounted, setIsMounted] = useState(false);
  const [editingArea, setEditingArea] = useState<any>(null);

  useEffect(() => {
    setIsMounted(true);
    return () => setIsMounted(false);
  }, []);
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
        price: parseFloat(formData.price) || 0,
        weight_surcharge: parseFloat(formData.weight_surcharge) || 0,
        volume_surcharge: parseFloat(formData.volume_surcharge) || 0,
        estimated_days: parseInt(formData.estimated_days) || 3,
        valid_from: formData.valid_from ? new Date(formData.valid_from).toISOString() : new Date().toISOString(),
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
            <label htmlFor="areasSearch" className="sr-only">Search by town name or postal code</label>
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input 
              id="areasSearch"
              name="areasSearch"
              type="text" 
              placeholder="Search by town name or postal code..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-6 py-4 bg-slate-50 rounded-2xl border-none outline-none focus:ring-2 focus:ring-primary/20 font-bold transition-all"
            />
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor="countyFilter" className="sr-only">Filter by County</label>
            <select 
              id="countyFilter"
              name="countyFilter"
              value={countyFilter}
              onChange={(e) => setCountyFilter(e.target.value)}
              className="px-6 py-4 bg-slate-50 rounded-2xl border-none outline-none focus:ring-2 focus:ring-primary/20 font-bold transition-all min-w-[200px]"
            >
              <option value="all">All Counties</option>
              {counties.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
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
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                        From: {area.valid_from ? new Date(area.valid_from).toLocaleDateString() : 'Active'}
                      </span>
                      {area.valid_until && (
                        <span className="text-[10px] font-bold text-orange-400 uppercase tracking-widest">
                          Until: {new Date(area.valid_until).toLocaleDateString()}
                        </span>
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
          {isMounted && isModalOpen && (
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
                    <label htmlFor="area_name" className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Town/Area Name</label>
                    <input 
                      id="area_name"
                      name="area_name"
                      required
                      type="text" 
                      value={formData.name}
                      onChange={(e) => setFormData({...formData, name: e.target.value})}
                      placeholder="e.g. Nairobi Central"
                      className="w-full px-6 py-4 bg-slate-50 rounded-2xl border-none outline-none focus:ring-2 focus:ring-primary/20 font-bold" 
                    />
                  </div>

                  <div>
                    <label htmlFor="area_county" className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">County</label>
                    <input 
                      id="area_county"
                      name="area_county"
                      type="text" 
                      value={formData.county}
                      onChange={(e) => setFormData({...formData, county: e.target.value})}
                      placeholder="e.g. Nairobi"
                      className="w-full px-6 py-4 bg-slate-50 rounded-2xl border-none outline-none focus:ring-2 focus:ring-primary/20 font-bold" 
                    />
                  </div>

                  <div>
                    <label htmlFor="area_postal_codes" className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Postal Codes</label>
                    <input 
                      id="area_postal_codes"
                      name="area_postal_codes"
                      type="text" 
                      value={formData.postal_codes}
                      onChange={(e) => setFormData({...formData, postal_codes: e.target.value})}
                      placeholder="e.g. 00100"
                      className="w-full px-6 py-4 bg-slate-50 rounded-2xl border-none outline-none focus:ring-2 focus:ring-primary/20 font-bold" 
                    />
                  </div>

                  <div>
                    <label htmlFor="area_price" className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Base Delivery Fee (KES)</label>
                    <input 
                      id="area_price"
                      name="area_price"
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
                    <label htmlFor="area_weight_surcharge" className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Weight Surcharge (per KG)</label>
                    <input 
                      id="area_weight_surcharge"
                      name="area_weight_surcharge"
                      type="number" 
                      min="0"
                      value={formData.weight_surcharge}
                      onChange={(e) => setFormData({...formData, weight_surcharge: e.target.value})}
                      placeholder="0.00"
                      className="w-full px-6 py-4 bg-slate-50 rounded-2xl border-none outline-none focus:ring-2 focus:ring-primary/20 font-bold" 
                    />
                  </div>

                  <div>
                    <label htmlFor="area_volume_surcharge" className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Volume Surcharge (per m³)</label>
                    <input 
                      id="area_volume_surcharge"
                      name="area_volume_surcharge"
                      type="number" 
                      min="0"
                      value={formData.volume_surcharge}
                      onChange={(e) => setFormData({...formData, volume_surcharge: e.target.value})}
                      placeholder="0.00"
                      className="w-full px-6 py-4 bg-slate-50 rounded-2xl border-none outline-none focus:ring-2 focus:ring-primary/20 font-bold" 
                    />
                  </div>

                  <div>
                    <label htmlFor="area_valid_from" className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Valid From</label>
                    <input 
                      id="area_valid_from"
                      name="area_valid_from"
                      type="date" 
                      value={formData.valid_from}
                      onChange={(e) => setFormData({...formData, valid_from: e.target.value})}
                      className="w-full px-6 py-4 bg-slate-50 rounded-2xl border-none outline-none focus:ring-2 focus:ring-primary/20 font-bold" 
                    />
                  </div>

                  <div>
                    <label htmlFor="area_valid_until" className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Valid Until (Optional)</label>
                    <input 
                      id="area_valid_until"
                      name="area_valid_until"
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
            <label htmlFor="inquiriesSearch" className="sr-only">Search inquiries</label>
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              id="inquiriesSearch"
              name="inquiriesSearch"
              type="text" 
              placeholder="Search inquiries..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-white border border-slate-100 rounded-xl outline-none focus:ring-2 focus:ring-primary/20 font-bold transition-all text-sm"
            />
          </div>
          <div className="flex gap-2">
            <label htmlFor="statusFilter" className="sr-only">Filter by Status</label>
            <select 
              id="statusFilter"
              name="statusFilter"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-3 bg-white border border-slate-100 rounded-xl outline-none focus:ring-2 focus:ring-primary/20 font-bold transition-all text-sm"
            >
              <option value="all">All Status</option>
              <option value="New">New</option>
              <option value="In Progress">In Progress</option>
              <option value="Resolved">Resolved</option>
            </select>
          </div>
          <div className="flex gap-2">
            <label htmlFor="deptFilter" className="sr-only">Filter by Department</label>
            <select 
              id="deptFilter"
              name="deptFilter"
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
  const [isMounted, setIsMounted] = useState(false);
  const [editingClub, setEditingClub] = useState<any>(null);

  useEffect(() => {
    setIsMounted(true);
    return () => setIsMounted(false);
  }, []);
  const [uploadProgress, setUploadProgress] = useState<{ [key: string]: number }>({});
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
      const url = await uploadSiteAsset(file, {
        onProgress: (progress) => {
          const percent = Math.round((progress.loaded / progress.total) * 100);
          setUploadProgress(prev => ({ ...prev, club: percent }));
        }
      });
      setFormData(prev => ({ ...prev, image_url: url }));
      toast.success('Asset synchronized', { id: loadingToast });
      setTimeout(() => setUploadProgress(prev => ({ ...prev, club: 0 })), 2000);
    } catch (error) {
      toast.error('Upload failed', { id: loadingToast });
    }
  };

  const handleEdit = (club: any) => {
    setEditingClub(club);
    setFormData({
      title: club.name || club.title || '',
      content: club.description || club.content || '',
      image_url: club.image_url || '',
      is_active: club.is_active ?? true,
      membership_price: club.metadata?.membership_price || club.membership_price || 0,
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
      const { membership_price, ...rest } = formData;
      const payload = {
        name: formData.title,
        description: formData.content,
        image_url: formData.image_url,
        is_active: formData.is_active,
        metadata: {
          ...rest.metadata,
          membership_price
        }
      };

      if (editingClub) {
        await updateBookClub(editingClub.id, payload);
        toast.success('Club updated', { id: loadingToast });
      } else {
        await createBookClub(payload);
        toast.success('Club initialized', { id: loadingToast });
      }
      setIsModalOpen(false);
      onUpdate();
    } catch (error: any) {
      console.error('Club error:', error);
      toast.error(`Operation failed: ${error.message || 'Check connectivity'}`, { id: loadingToast });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to decommission this book club?')) return;
    const loadingToast = toast.loading('Decommissioning Club...');
    try {
      await deleteRecord('book_clubs', id);
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
                <img src={club.image_url} alt={club.name || club.title} className="w-full h-full object-cover" />
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
            
            <h3 className="text-xl font-black tracking-tighter uppercase mb-2 line-clamp-1">{club.name || club.title}</h3>
            <p className="text-sm text-slate-500 font-medium mb-6 line-clamp-2 leading-relaxed">{club.description || club.content}</p>
            
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
        {isMounted && isModalOpen && (
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
                          <label htmlFor="club-upload" className="cursor-pointer bg-white text-slate-900 px-6 py-2 rounded-full font-black text-xs uppercase tracking-widest">
                            {uploadProgress.club > 0 && uploadProgress.club < 100 ? `Uploading (${uploadProgress.club}%)...` : 'Replace Asset'}
                          </label>
                        </div>
                      </>
                    ) : (
                      <label htmlFor="club-upload" className="absolute inset-0 flex flex-col items-center justify-center cursor-pointer hover:bg-slate-100 transition-all">
                        <ImageIcon className="w-12 h-12 text-slate-300 mb-2" />
                        <span className="font-bold text-xs text-slate-400 uppercase tracking-widest">
                          {uploadProgress.club > 0 && uploadProgress.club < 100 ? `Uploading (${uploadProgress.club}%)...` : 'Upload Community Asset'}
                        </span>
                      </label>
                    )}
                    {uploadProgress.club > 0 && uploadProgress.club < 100 && (
                      <div className="absolute bottom-0 left-0 right-0 h-1 bg-slate-100">
                        <div 
                          className="h-full bg-primary transition-all duration-300"
                          style={{ width: `${uploadProgress.club}%` }}
                        />
                      </div>
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
  const [isMounted, setIsMounted] = useState(false);
  const [isRSVPModalOpen, setIsRSVPModalOpen] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    return () => setIsMounted(false);
  }, []);
  const [selectedEventRSVPs, setSelectedEventRSVPs] = useState<any[]>([]);
  const [editingEvent, setEditingEvent] = useState<any>(null);
  const [uploadProgress, setUploadProgress] = useState<{ [key: string]: number }>({});
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
      const url = await uploadSiteAsset(file, {
        onProgress: (progress) => {
          const percent = Math.round((progress.loaded / progress.total) * 100);
          setUploadProgress(prev => ({ ...prev, event: percent }));
        }
      });
      setFormData(prev => ({ ...prev, image_url: url }));
      toast.success('Asset synchronized', { id: loadingToast });
      setTimeout(() => setUploadProgress(prev => ({ ...prev, event: 0 })), 2000);
    } catch (error) {
      toast.error('Upload failed', { id: loadingToast });
    }
  };

  const handleEdit = (event: any) => {
    setEditingEvent(event);
    setFormData({
      title: event.name || event.title || '',
      content: event.description || event.content || '',
      image_url: event.image_url || '',
      is_active: event.is_active ?? true,
      metadata: {
        date: event.date || event.metadata?.date || '',
        time: event.time || event.metadata?.time || '14:00',
        location: event.location || event.metadata?.location || 'Virtual / ReadMart Hub',
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
        name: formData.title,
        description: formData.content,
        image_url: formData.image_url,
        is_active: formData.is_active,
        date: formData.metadata.date,
        time: formData.metadata.time,
        location: formData.metadata.location,
        metadata: formData.metadata
      };

      if (editingEvent) {
        await updateEvent(editingEvent.id, payload);
        toast.success('Event updated', { id: loadingToast });
      } else {
        await createEvent(payload);
        toast.success('Event deployed', { id: loadingToast });
      }
      setIsModalOpen(false);
      onUpdate();
    } catch (error: any) {
      console.error('Event error:', error);
      toast.error(`Operation failed: ${error.message || 'Check connectivity'}`, { id: loadingToast });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to cancel this event?')) return;
    const loadingToast = toast.loading('Cancelling Event...');
    try {
      await deleteRecord('events', id);
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
                <img src={event.image_url} alt={event.name || event.title} className="w-full h-full object-cover" />
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
                <h3 className="text-xl font-black tracking-tighter uppercase line-clamp-1">{event.name || event.title}</h3>
                <div className="flex items-center gap-2 text-primary font-bold text-xs mt-1">
                  <Clock className="w-3 h-3" />
                  {event.date || event.metadata?.date} @ {event.time || event.metadata?.time}
                </div>
              </div>

              <div className="flex items-center gap-2 text-slate-400 text-xs font-bold">
                <MapPin className="w-3 h-3" />
                {event.location || event.metadata?.location}
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
        {isMounted && isModalOpen && (
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
                          <label htmlFor="event-upload" className="cursor-pointer bg-white text-slate-900 px-6 py-2 rounded-full font-black text-xs uppercase tracking-widest">
                            {uploadProgress.event > 0 && uploadProgress.event < 100 ? `Uploading (${uploadProgress.event}%)...` : 'Replace Asset'}
                          </label>
                        </div>
                      </>
                    ) : (
                      <label htmlFor="event-upload" className="absolute inset-0 flex flex-col items-center justify-center cursor-pointer hover:bg-slate-100 transition-all">
                        <ImageIcon className="w-12 h-12 text-slate-300 mb-2" />
                        <span className="font-bold text-xs text-slate-400 uppercase tracking-widest">
                          {uploadProgress.event > 0 && uploadProgress.event < 100 ? `Uploading (${uploadProgress.event}%)...` : 'Upload Event Asset'}
                        </span>
                      </label>
                    )}
                    {uploadProgress.event > 0 && uploadProgress.event < 100 && (
                      <div className="absolute bottom-0 left-0 right-0 h-1 bg-slate-100">
                        <div 
                          className="h-full bg-primary transition-all duration-300"
                          style={{ width: `${uploadProgress.event}%` }}
                        />
                      </div>
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

function AgreementsView({ partnerships, authors, protocols, onUpdate }: any) {
  const [selectedApp, setSelectedApp] = useState<any>(null);
  const [isMounted, setIsMounted] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    return () => setIsMounted(false);
  }, []);
  const [isProtocolModalOpen, setIsProtocolModalOpen] = useState(false);
  const [editingProtocol, setEditingProtocol] = useState<any>(null);
  const [protocolFormData, setProtocolFormData] = useState({
    title: '',
    content: '',
    type: 'author',
    is_active: true,
    version: '1.0',
    metadata: { key_terms: [] as string[] }
  });

  const handleProtocolSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const loadingToast = toast.loading(editingProtocol ? 'Updating Protocol...' : 'Creating Protocol...');
    try {
      if (editingProtocol) {
        await updateProtocolAgreement(editingProtocol.id, protocolFormData);
        toast.success('Protocol updated successfully', { id: loadingToast });
      } else {
        await createProtocolAgreement(protocolFormData);
        toast.success('Protocol created successfully', { id: loadingToast });
      }
      setIsProtocolModalOpen(false);
      setEditingProtocol(null);
      setProtocolFormData({ 
        title: '', 
        content: '', 
        type: 'author', 
        is_active: true, 
        version: '1.0',
        metadata: { key_terms: [] }
      });
      onUpdate();
    } catch (error) {
      console.error('Protocol save error:', error);
      toast.error('Failed to save protocol', { id: loadingToast });
    }
  };

  const handleDeleteProtocol = async (id: string) => {
    if (!confirm('Are you sure you want to delete this protocol?')) return;
    const loadingToast = toast.loading('Deleting Protocol...');
    try {
      await deleteProtocolAgreement(id);
      toast.success('Protocol deleted', { id: loadingToast });
      onUpdate();
    } catch (error) {
      toast.error('Failed to delete protocol', { id: loadingToast });
    }
  };

  const handleStatusUpdate = async (table: string, id: string, status: string, name: string, userId?: string) => {
    const loadingToast = toast.loading(`Updating status for ${name}...`);
    try {
      await updateApplicationStatus(table, id, status, userId);
      
      toast.success(`Status updated to ${status}`, { id: loadingToast });
      onUpdate();
      if (selectedApp && selectedApp.id === id) {
        setSelectedApp({ ...selectedApp, status });
      }
    } catch (error) {
      console.error('Status update error:', error);
      toast.error('Status update failed', { id: loadingToast });
    }
  };

  const handleUploadAgreement = async (table: string, id: string, file: File, name: string, userId: string) => {
    setIsUploading(true);
    const loadingToast = toast.loading(`Uploading agreement for ${name}...`);
    try {
      const path = await uploadAgreementFile(file, `${id}_agreement`);
      
      // 1. Find the latest active protocol for this type to link it
      const type = table === 'author_applications' ? 'author' : 'partner';
      // Mapping UI 'partner' to database 'service_provider' for templates
      const protocolType = type === 'partner' ? 'service_provider' : 'author';
      const protocol = protocols.find((p: any) => p.type === protocolType && p.is_active);

      // 2. Sync with the applications API
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch('/api/applications', {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({ 
          id, 
          type, 
          status: 'agreement_sent',
          agreement_url: path
        })
      });

      if (!response.ok) throw new Error('API request failed');

      // 3. Create/Update record in the agreements table for the applicant's dashboard
      const { error: agreementError } = await supabase
        .from('agreements')
        .upsert({
          title: protocol?.title || `${type === 'author' ? 'Author' : 'Partnership'} Collaboration Protocol`,
          description: protocol?.content || `Terms and conditions for your ${type} collaboration with ReadMart.`,
          template_url: path,
          partner_id: userId,
          type: type as any,
          status: 'pending',
          protocol_id: protocol?.id,
          key_terms: protocol?.metadata?.key_terms || []
        }, { onConflict: 'partner_id, type' });

      if (agreementError) {
        console.error('Agreement record sync failed:', agreementError);
        toast.error(`Database sync failed: ${agreementError.message}`, { id: loadingToast });
      }

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
        
        const type = table === 'author_applications' ? 'author' : 'partner';
        const protocolType = type === 'partner' ? 'service_provider' : 'author';
        const protocol = protocols.find((p: any) => p.type === protocolType && p.is_active);

        // Try to sync agreement table even in fallback
        const { error: fallbackError } = await supabase.from('agreements').upsert({
          title: protocol?.title || `${table.includes('author') ? 'Author' : 'Partnership'} Collaboration Protocol`,
          description: protocol?.content || `Terms and conditions for your collaboration.`,
          template_url: path,
          partner_id: userId,
          type: type as any,
          status: 'pending',
          protocol_id: protocol?.id
        }, { onConflict: 'partner_id, type' });

        if (fallbackError) {
          console.error('Fallback agreement sync failed:', fallbackError);
        }

        toast.success('Agreement uploaded (Direct DB)', { id: loadingToast });
        onUpdate();
      } catch (dbError: any) {
        console.error('Agreement fallback error:', dbError);
        toast.error(dbError.message || 'Upload failed', { id: loadingToast });
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
    
    // Determine bucket based on path or context
    const bucket = path.includes('signed') ? 'signed_agreements' : 'agreements';
    
    const { data, error } = await supabase.storage
      .from(bucket)
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

  const groupedProtocols = useMemo(() => {
    return protocols.reduce((acc: any, protocol: any) => {
      const type = protocol.type || 'other';
      if (!acc[type]) acc[type] = [];
      acc[type].push(protocol);
      return acc;
    }, {});
  }, [protocols]);

  const getAppName = (app: any) => app.business_name || app.company_name || app.organization || app.full_name || app.contact_person || 'Unnamed Entity';

  const ApplicationCard = ({ app, table, type }: any) => {
    const appName = getAppName(app);
    return (
      <div className="p-6 bg-slate-50 rounded-[32px] border border-slate-100 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-black text-slate-900 text-lg">
              {appName}
            </p>
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
                  if (file) handleUploadAgreement(table, app.id, file, appName, app.user_id);
                }}
              />
            </label>
          )}

          {app.status === 'agreement_confirming' && (
            <button 
              onClick={() => handleStatusUpdate(table, app.id, 'activating', appName, app.user_id)}
              className="flex-1 flex items-center justify-center gap-2 bg-indigo-600 text-white py-3 rounded-xl font-bold text-xs hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-600/20"
            >
              <CheckCircle className="w-4 h-4" />
              Process Activation
            </button>
          )}

          {app.status === 'activating' && (
            <button 
              onClick={() => handleStatusUpdate(table, app.id, 'completed', appName, app.user_id)}
              className="flex-1 flex items-center justify-center gap-2 bg-green-600 text-white py-3 rounded-xl font-bold text-xs hover:bg-green-700 transition-all shadow-lg shadow-green-600/20"
            >
              <Sparkles className="w-4 h-4" />
              Final Activation
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-8 pb-20">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-4xl font-black tracking-tighter uppercase mb-2">Protocol Agreements</h1>
          <p className="text-slate-500 font-medium">Verify and approve author and partner collaborations</p>
        </div>
        <button 
          onClick={() => {
            setEditingProtocol(null);
            setProtocolFormData({ 
              title: '', 
              content: '', 
              type: 'author', 
              is_active: true, 
              version: '1.0',
              metadata: { key_terms: [] }
            });
            setIsProtocolModalOpen(true);
          }}
          className="bg-primary text-white px-8 py-4 rounded-2xl font-black uppercase tracking-tighter flex items-center gap-2 hover:opacity-90 transition-all shadow-xl shadow-primary/20"
        >
          <Plus className="w-5 h-5" />
          Define Protocol
        </button>
      </div>

      {/* Protocol Templates Management */}
      <div className="bg-white p-10 rounded-[40px] border border-slate-100 shadow-sm">
        <h3 className="text-xl font-black tracking-tighter uppercase mb-8 flex items-center gap-2">
          <Settings className="w-6 h-6 text-primary" />
          Active Protocols
        </h3>
        
        <div className="space-y-10">
          {Object.entries(groupedProtocols).map(([type, typeProtocols]: [string, any]) => (
            <div key={type} className="space-y-6">
              <div className="flex items-center gap-4">
                <div className="h-px flex-1 bg-slate-100" />
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 bg-slate-50 px-4 py-1 rounded-full border border-slate-100">
                  {type === 'author' ? 'Author Protocols' : 'Service Provider Protocols'}
                </span>
                <div className="h-px flex-1 bg-slate-100" />
              </div>

              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {typeProtocols.map((protocol: any) => (
                  <div key={protocol.id} className="p-6 bg-slate-50 rounded-[32px] border border-slate-100 group hover:border-primary/30 transition-all">
                    <div className="flex justify-between items-start mb-4">
                      <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${
                        protocol.type === 'author' ? 'bg-purple-50 text-purple-600 border-purple-100' : 'bg-blue-50 text-blue-600 border-blue-100'
                      }`}>
                        {protocol.type}
                      </span>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                        <button 
                          onClick={() => {
                            setEditingProtocol(protocol);
                            setProtocolFormData({
                              title: protocol.title,
                              content: protocol.content,
                              type: protocol.type,
                              is_active: protocol.is_active,
                              version: protocol.version || '1.0',
                              metadata: protocol.metadata || { key_terms: [] }
                            });
                            setIsProtocolModalOpen(true);
                          }}
                          className="p-2 hover:bg-white rounded-xl text-slate-400 hover:text-primary transition-all"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => handleDeleteProtocol(protocol.id)}
                          className="p-2 hover:bg-white rounded-xl text-slate-400 hover:text-red-500 transition-all"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    <h4 className="font-black text-slate-900 mb-1">{protocol.title}</h4>
                    <p className="text-xs font-bold text-slate-400 mb-4">v{protocol.version || '1.0'}</p>
                    <div className="text-xs text-slate-500 line-clamp-3 font-medium mb-4 whitespace-pre-wrap">
                      {protocol.content}
                    </div>
                    
                    {protocol.metadata?.key_terms?.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-4">
                        {protocol.metadata.key_terms.map((term: string, idx: number) => (
                          <span key={idx} className="px-2 py-0.5 bg-white border border-slate-100 rounded-md text-[9px] font-bold text-slate-400 uppercase">
                            {term}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}

          {protocols.length === 0 && (
            <div className="py-12 text-center border-2 border-dashed border-slate-100 rounded-[32px]">
              <AlertCircle className="w-12 h-12 text-slate-200 mx-auto mb-4" />
              <p className="text-slate-400 font-bold uppercase text-xs tracking-widest">No active protocols defined</p>
            </div>
          )}
        </div>
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
              <p className="text-center py-8 text-slate-400 font-bold uppercase text-xs tracking-widest">No partnership applications found</p>
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
              <p className="text-center py-8 text-slate-400 font-bold uppercase text-xs tracking-widest">No author applications found</p>
            )}
          </div>
        </div>
      </div>

      {/* Protocol Modal */}
      <AnimatePresence>
        {isMounted && isProtocolModalOpen && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsProtocolModalOpen(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative bg-white w-full max-w-2xl rounded-[40px] shadow-2xl overflow-hidden"
            >
              <div className="p-8 border-b border-slate-50 flex justify-between items-center bg-slate-50/50">
                <h2 className="text-2xl font-black uppercase tracking-tighter">
                  {editingProtocol ? 'Refine Protocol' : 'Define New Protocol'}
                </h2>
                <button onClick={() => setIsProtocolModalOpen(false)} className="p-2 hover:bg-white rounded-full transition-all">
                  <XCircle className="w-8 h-8 text-slate-300 hover:text-red-500" />
                </button>
              </div>
              <form onSubmit={handleProtocolSubmit} className="p-10 space-y-6">
                <div className="grid grid-cols-2 gap-6">
                  <div className="col-span-2">
                    <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Protocol Title</label>
                    <input 
                      required
                      type="text"
                      value={protocolFormData.title}
                      onChange={(e) => setProtocolFormData({...protocolFormData, title: e.target.value})}
                      className="w-full bg-slate-50 border-none rounded-2xl px-6 py-4 font-bold outline-none focus:ring-2 focus:ring-primary transition-all"
                      placeholder="e.g. Standard Author Collaboration Terms"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Protocol Type</label>
                    <select 
                      value={protocolFormData.type}
                      onChange={(e) => setProtocolFormData({...protocolFormData, type: e.target.value})}
                      className="w-full bg-slate-50 border-none rounded-2xl px-6 py-4 font-bold outline-none focus:ring-2 focus:ring-primary transition-all appearance-none"
                    >
                      <option value="author">Author Collaboration</option>
                      <option value="service_provider">Service Provider / Partner</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Version</label>
                    <input 
                      type="text"
                      value={protocolFormData.version}
                      onChange={(e) => setProtocolFormData({...protocolFormData, version: e.target.value})}
                      className="w-full bg-slate-50 border-none rounded-2xl px-6 py-4 font-bold outline-none focus:ring-2 focus:ring-primary transition-all"
                      placeholder="1.0"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Key Terms (Highlights)</label>
                    <div className="flex flex-wrap gap-2 p-4 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
                      {protocolFormData.metadata.key_terms.map((term, idx) => (
                        <span key={idx} className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl text-xs font-bold border border-slate-100 group">
                          {term}
                          <button 
                            type="button"
                            onClick={() => {
                              const newTerms = [...protocolFormData.metadata.key_terms];
                              newTerms.splice(idx, 1);
                              setProtocolFormData({...protocolFormData, metadata: { ...protocolFormData.metadata, key_terms: newTerms }});
                            }}
                            className="text-slate-300 hover:text-red-500 transition-all"
                          >
                            <XCircle className="w-3 h-3" />
                          </button>
                        </span>
                      ))}
                      <input 
                        type="text"
                        placeholder="Add term + Enter"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            const val = (e.target as HTMLInputElement).value.trim();
                            if (val && !protocolFormData.metadata.key_terms.includes(val)) {
                              setProtocolFormData({
                                ...protocolFormData,
                                metadata: {
                                  ...protocolFormData.metadata,
                                  key_terms: [...protocolFormData.metadata.key_terms, val]
                                }
                              });
                              (e.target as HTMLInputElement).value = '';
                            }
                          }
                        }}
                        className="bg-transparent border-none outline-none font-bold text-xs flex-1 min-w-[120px]"
                      />
                    </div>
                  </div>
                  <div className="col-span-2">
                    <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Protocol Content (Markdown/Text)</label>
                    <textarea 
                      required
                      rows={8}
                      value={protocolFormData.content}
                      onChange={(e) => setProtocolFormData({...protocolFormData, content: e.target.value})}
                      className="w-full bg-slate-50 border-none rounded-2xl px-6 py-4 font-bold outline-none focus:ring-2 focus:ring-primary transition-all resize-none"
                      placeholder="Define the core terms, rights, and obligations..."
                    />
                  </div>
                </div>
                <button 
                  type="submit"
                  className="w-full bg-primary text-white py-5 rounded-2xl font-black uppercase tracking-widest hover:opacity-90 transition-all shadow-xl shadow-primary/20"
                >
                  {editingProtocol ? 'Synchronize Protocol' : 'Deploy Protocol'}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Detail Modal */}
      <AnimatePresence>
        {isMounted && selectedApp && (
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
                        onClick={() => handleStatusUpdate(selectedApp._table, selectedApp.id, 'rejected', selectedApp.full_name, selectedApp.user_id)}
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
                      onClick={() => handleStatusUpdate(selectedApp._table, selectedApp.id, selectedApp.status === 'agreement_confirming' ? 'activating' : 'completed', selectedApp.full_name, selectedApp.user_id)}
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
  const [isAuditModalOpen, setIsAuditModalOpen] = useState(false);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [isMetricsModalOpen, setIsMetricsModalOpen] = useState(false);
  const [shouldRenderModalChart, setShouldRenderModalChart] = useState(false);
  const [selectedMetrics, setSelectedMetrics] = useState<any[]>([]);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    if (isMetricsModalOpen) {
      const timer = setTimeout(() => setShouldRenderModalChart(true), 500);
      return () => clearTimeout(timer);
    } else {
      setShouldRenderModalChart(false);
    }
  }, [isMetricsModalOpen]);

  useEffect(() => {
    setIsMounted(true);
    return () => setIsMounted(false);
  }, []);
  
  const [formData, setFormData] = useState({
    code: '',
    promo_signature: '',
    discount_type: 'percentage',
    discount_value: 0,
    min_order_amount: 0,
    usage_limit: 100,
    predicted_impact: 0,
    start_at: new Date().toISOString().slice(0, 16),
    expires_at: '',
    command_logic: '{}',
    is_active: true
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const loadingToast = toast.loading(editingPromo ? 'Updating Campaign...' : 'Initializing Campaign...');
    
    try {
      // 1. Validate JSON first
      let parsedLogic = {};
      try {
        parsedLogic = JSON.parse(formData.command_logic || '{}');
      } catch (jsonErr: any) {
        console.error('JSON Parse Error:', jsonErr);
        toast.error(`Invalid Command Logic: ${jsonErr.message}`, { id: loadingToast });
        return;
      }

      const payload = {
        ...formData,
        command_logic: parsedLogic
      };

      if (editingPromo) {
        await updateRecord('promos', editingPromo.id, payload);
      } else {
        await initializeCampaign(payload);
      }
      
      toast.success(editingPromo ? 'Campaign Modified' : 'Campaign Initialized', { id: loadingToast });
      setIsModalOpen(false);
      onUpdate();
    } catch (error: any) {
      console.error('Campaign error:', error);
      const errorMessage = error.message || 'Check database connectivity and permissions.';
      toast.error(`Campaign synchronization failed: ${errorMessage}`, { id: loadingToast });
    }
  };

  const handleCalculateImpact = async (id: string) => {
    const loadingToast = toast.loading('Recalculating Impact...');
    try {
      await calculateImpact(id);
      toast.success('Impact Value Updated', { id: loadingToast });
      onUpdate();
    } catch (error) {
      toast.error('Impact calculation failed', { id: loadingToast });
    }
  };

  const viewAuditLogs = async (id: string) => {
    const loadingToast = toast.loading('Fetching Audit Trail...');
    try {
      const logs = await getPromoAuditLogs(id);
      setAuditLogs(logs);
      setIsAuditModalOpen(true);
      toast.dismiss(loadingToast);
    } catch (error) {
      toast.error('Audit fetch failed', { id: loadingToast });
    }
  };

  const viewMetrics = async (id: string) => {
    const loadingToast = toast.loading('Fetching Performance Metrics...');
    try {
      const metrics = await getPromoMetrics(id);
      setSelectedMetrics(metrics);
      setIsMetricsModalOpen(true);
      toast.dismiss(loadingToast);
    } catch (error) {
      toast.error('Metrics fetch failed', { id: loadingToast });
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
        promo_signature: promo.promo_signature || '',
        discount_type: promo.discount_type,
        discount_value: promo.discount_value,
        min_order_amount: promo.min_order_amount,
        usage_limit: promo.usage_limit,
        predicted_impact: promo.predicted_impact || 0,
        start_at: promo.start_at ? new Date(promo.start_at).toISOString().slice(0, 16) : new Date().toISOString().slice(0, 16),
        expires_at: promo.expires_at ? new Date(promo.expires_at).toISOString().split('T')[0] : '',
        command_logic: JSON.stringify(promo.command_logic || {}, null, 2),
        is_active: promo.is_active
      });
    } else {
      setEditingPromo(null);
      setFormData({
        code: '',
        promo_signature: `SIG-${Math.random().toString(36).substring(2, 9).toUpperCase()}`,
        discount_type: 'percentage',
        discount_value: 0,
        min_order_amount: 0,
        usage_limit: 100,
        predicted_impact: 0,
        start_at: new Date().toISOString().slice(0, 16),
        expires_at: '',
        command_logic: '{\n  "auto_expire": true,\n  "notify_users": false\n}',
        is_active: true
      });
    }
    setIsModalOpen(true);
  };

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-4xl font-black tracking-tighter uppercase mb-2">Campaign Intelligence</h1>
          <p className="text-slate-500 font-medium">Revenue manipulation and activity governance</p>
        </div>
        <div className="flex gap-4">
          <div className="bg-slate-50 px-6 py-4 rounded-2xl flex items-center gap-4 border border-slate-100">
            <div className="p-2 bg-green-500/10 rounded-full">
              <TrendingUp className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase text-slate-400">Total Ecosystem Impact</p>
              <p className="text-lg font-black text-slate-900">KES {data.reduce((acc: number, p: any) => acc + (p.impact_value || 0), 0).toLocaleString()}</p>
            </div>
          </div>
          <button 
            onClick={() => openModal()}
            className="bg-primary text-white px-8 py-4 rounded-2xl font-black uppercase tracking-tighter flex items-center gap-2 hover:opacity-90 transition-all shadow-xl shadow-primary/20"
          >
            <Plus className="w-5 h-5" />
            Initialize Campaign
          </button>
        </div>
      </div>

      {/* System Health & Growth Alerts */}
      <div className="grid md:grid-cols-3 gap-6">
        <div className="bg-blue-50/50 p-6 rounded-[32px] border border-blue-100/50 flex gap-4">
          <div className="w-12 h-12 bg-blue-500 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/20">
            <Sparkles className="w-6 h-6" />
          </div>
          <div>
            <h4 className="font-black text-blue-900 uppercase text-xs mb-1">Growth Insight</h4>
            <p className="text-xs font-bold text-blue-700/70">A/B tests suggest fixed KES discounts perform 22% better for orders &gt; KES 5000.</p>
          </div>
        </div>
        <div className="bg-orange-50/50 p-6 rounded-[32px] border border-orange-100/50 flex gap-4">
          <div className="w-12 h-12 bg-orange-500 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-orange-500/20">
            <AlertCircle className="w-6 h-6" />
          </div>
          <div>
            <h4 className="font-black text-orange-900 uppercase text-xs mb-1">Governance Alert</h4>
            <p className="text-xs font-bold text-orange-700/70">3 protocols are nearing temporal expiration. Review decommission schedules.</p>
          </div>
        </div>
        <div className="bg-green-50/50 p-6 rounded-[32px] border border-green-100/50 flex gap-4">
          <div className="w-12 h-12 bg-green-500 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-green-500/20">
            <Shield className="w-6 h-6" />
          </div>
          <div>
            <h4 className="font-black text-green-900 uppercase text-xs mb-1">Integrity Secure</h4>
            <p className="text-xs font-bold text-green-700/70">Real-time anti-manipulation algorithms active. No abnormal fluctuations detected.</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-[40px] border border-slate-100 shadow-sm overflow-hidden">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-slate-50/50">
              <th className="px-8 py-6 text-left text-[10px] font-black uppercase tracking-widest text-slate-400">Promo Signature</th>
              <th className="px-8 py-6 text-left text-[10px] font-black uppercase tracking-widest text-slate-400">Impact (Actual/Pred)</th>
              <th className="px-8 py-6 text-left text-[10px] font-black uppercase tracking-widest text-slate-400">Utilization</th>
              <th className="px-8 py-6 text-left text-[10px] font-black uppercase tracking-widest text-slate-400">Temporal Limit</th>
              <th className="px-8 py-6 text-right text-[10px] font-black uppercase tracking-widest text-slate-400">Governance</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {data.map((promo: any) => (
              <tr key={promo.id} className="hover:bg-slate-50/30 transition-all">
                <td className="px-8 py-6">
                  <div className="flex flex-col">
                    <span className="font-black text-slate-900 bg-slate-100 px-3 py-1 rounded-lg w-fit mb-1">{promo.code}</span>
                    <span className="text-[10px] font-bold text-slate-400 font-mono uppercase tracking-tighter">{promo.promo_signature}</span>
                  </div>
                </td>
                <td className="px-8 py-6">
                  <div className="flex flex-col">
                    <span className="font-black text-green-600">KES {promo.impact_value || 0}</span>
                    <span className="text-[10px] font-bold text-slate-400">Predicted: KES {promo.predicted_impact || 0}</span>
                  </div>
                </td>
                <td className="px-8 py-6">
                  <div className="flex flex-col gap-1">
                    <div className="flex justify-between text-[10px] font-black uppercase">
                      <span>{promo.usage_count || 0} used</span>
                      <span>{promo.usage_limit} limit</span>
                    </div>
                    <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                      <div 
                        className="bg-primary h-full transition-all duration-1000" 
                        style={{ width: `${Math.min(100, ((promo.usage_count || 0) / promo.usage_limit) * 100)}%` }}
                      />
                    </div>
                  </div>
                </td>
                <td className="px-8 py-6">
                  <div className="flex flex-col text-[10px] font-bold text-slate-500">
                    <span className="uppercase">Start: {promo.start_at ? new Date(promo.start_at).toLocaleDateString() : 'Immediate'}</span>
                    <span className="uppercase text-red-400">End: {promo.expires_at ? new Date(promo.expires_at).toLocaleDateString() : 'Never'}</span>
                  </div>
                </td>
                <td className="px-8 py-6 text-right">
                  <div className="flex justify-end gap-2">
                    <button 
                      onClick={() => handleCalculateImpact(promo.id)}
                      title="Calculate Impact"
                      className="p-2 hover:bg-slate-100 rounded-xl transition-all text-slate-400 hover:text-green-500"
                    >
                      <RefreshCw className="w-5 h-5" />
                    </button>
                    <button 
                      onClick={() => viewMetrics(promo.id)}
                      title="View Metrics"
                      className="p-2 hover:bg-slate-100 rounded-xl transition-all text-slate-400 hover:text-blue-500"
                    >
                      <BarChart2 className="w-5 h-5" />
                    </button>
                    <button 
                      onClick={() => viewAuditLogs(promo.id)}
                      title="Audit Trail"
                      className="p-2 hover:bg-slate-100 rounded-xl transition-all text-slate-400 hover:text-orange-500"
                    >
                      <Shield className="w-5 h-5" />
                    </button>
                    <div className="w-px h-8 bg-slate-100 mx-2" />
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
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Audit Logs Modal */}
      <AnimatePresence>
        {isAuditModalOpen && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsAuditModalOpen(false)} className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="relative bg-white w-full max-w-3xl rounded-[40px] shadow-2xl overflow-hidden max-h-[80vh] flex flex-col">
              <div className="p-8 border-b border-slate-50 flex justify-between items-center bg-slate-50/50">
                <h2 className="text-2xl font-black uppercase tracking-tighter">Campaign Audit Trail</h2>
                <button onClick={() => setIsAuditModalOpen(false)} className="p-2 hover:bg-white rounded-full"><XCircle className="w-8 h-8 text-slate-300" /></button>
              </div>
              <div className="flex-1 overflow-y-auto p-10 custom-scrollbar space-y-4">
                {auditLogs.length === 0 ? (
                  <div className="text-center py-20 text-slate-400 font-bold">No audit records found for this protocol.</div>
                ) : (
                  auditLogs.map((log) => (
                    <div key={log.id} className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
                      <div className="flex justify-between mb-2">
                        <span className="text-[10px] font-black uppercase text-primary bg-primary/10 px-2 py-1 rounded">{log.action}</span>
                        <span className="text-[10px] font-bold text-slate-400">{new Date(log.created_at).toLocaleString()}</span>
                      </div>
                      <p className="text-sm font-bold text-slate-600">Actor: {log.actor?.full_name || 'System'}</p>
                      {log.new_state && (
                        <pre className="mt-4 text-[10px] font-mono bg-white p-4 rounded-xl overflow-x-auto">
                          {JSON.stringify(log.new_state, null, 2)}
                        </pre>
                      )}
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Metrics & Performance Modal */}
      <AnimatePresence>
        {isMetricsModalOpen && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsMetricsModalOpen(false)} className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="relative bg-white w-full max-w-4xl rounded-[40px] shadow-2xl overflow-hidden max-h-[80vh] flex flex-col">
              <div className="p-8 border-b border-slate-50 flex justify-between items-center bg-slate-50/50">
                <div>
                  <h2 className="text-2xl font-black uppercase tracking-tighter">Growth Metrics</h2>
                  <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">A/B Testing & Performance Analytics</p>
                </div>
                <button onClick={() => setIsMetricsModalOpen(false)} className="p-2 hover:bg-white rounded-full"><XCircle className="w-8 h-8 text-slate-300" /></button>
              </div>
              <div className="flex-1 overflow-y-auto p-10 custom-scrollbar">
                {selectedMetrics.length === 0 ? (
                  <div className="text-center py-20">
                    <Sparkles className="w-12 h-12 text-primary/20 mx-auto mb-4" />
                    <p className="text-slate-400 font-bold uppercase tracking-widest">Awaiting Initial Performance Data...</p>
                    <p className="text-xs text-slate-300 mt-2">Growth hacking algorithms are currently analyzing user behavior.</p>
                  </div>
                ) : (
                  <div className="space-y-8">
                    <div className="h-64 min-h-[256px] relative">
                      {shouldRenderModalChart && (
                        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                        <AreaChart data={selectedMetrics}>
                          <defs>
                            <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1}/>
                              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                          <XAxis dataKey="recorded_at" hide />
                          <YAxis hide />
                          <Tooltip 
                            contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                            labelFormatter={(label: any) => new Date(label).toLocaleString()}
                          />
                          <Area type="monotone" dataKey="metric_value" stroke="#3b82f6" strokeWidth={4} fillOpacity={1} fill="url(#colorValue)" />
                        </AreaChart>
                      </ResponsiveContainer>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      {selectedMetrics.slice(0, 4).map((metric, idx) => (
                        <div key={idx} className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
                          <p className="text-[10px] font-black uppercase text-slate-400 mb-1">{metric.metric_name}</p>
                          <p className="text-2xl font-black text-slate-900">{metric.metric_value}</p>
                          {metric.variant_id && (
                            <span className="text-[8px] font-black bg-primary/10 text-primary px-2 py-0.5 rounded-full mt-2 inline-block">
                              VARIANT: {metric.variant_id}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Campaign Initialization/Edit Modal */}
      <AnimatePresence>
        {isMounted && isModalOpen && (
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
                  <h2 className="text-2xl font-black uppercase tracking-tighter">{editingPromo ? 'Modify Protocol' : 'Initialize Campaign'}</h2>
                  <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Revenue Manipulation Protocol</p>
                </div>
                <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-white rounded-full transition-all">
                  <XCircle className="w-8 h-8 text-slate-300 hover:text-red-500" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-10 space-y-8 custom-scrollbar">
                <div className="grid grid-cols-2 gap-8">
                  <div className="space-y-4">
                    <h3 className="text-xs font-black uppercase tracking-widest text-primary flex items-center gap-2">
                      <Tag className="w-4 h-4" /> Identity & Strategy
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Public Code</label>
                        <input 
                          required
                          type="text" 
                          value={formData.code}
                          onChange={(e) => setFormData({...formData, code: e.target.value.toUpperCase()})}
                          placeholder="READMART20"
                          className="w-full px-6 py-4 bg-slate-50 rounded-2xl border-none outline-none focus:ring-2 focus:ring-primary/20 font-bold" 
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Promo Signature</label>
                        <input 
                          required
                          type="text" 
                          value={formData.promo_signature}
                          onChange={(e) => setFormData({...formData, promo_signature: e.target.value})}
                          className="w-full px-6 py-4 bg-slate-50 rounded-2xl border-none outline-none focus:ring-2 focus:ring-primary/20 font-bold font-mono" 
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Impact Type</label>
                        <select 
                          value={formData.discount_type}
                          onChange={(e) => setFormData({...formData, discount_type: e.target.value})}
                          className="w-full px-6 py-4 bg-slate-50 rounded-2xl border-none outline-none focus:ring-2 focus:ring-primary/20 font-bold"
                        >
                          <option value="percentage">Percentage (%)</option>
                          <option value="fixed">Fixed (KES)</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Impact Value</label>
                        <input 
                          required
                          type="number" 
                          value={formData.discount_value}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value);
                            setFormData(prev => ({ ...prev, discount_value: isNaN(val) ? 0 : val }));
                          }}
                          className="w-full px-6 py-4 bg-slate-50 rounded-2xl border-none outline-none focus:ring-2 focus:ring-primary/20 font-bold" 
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h3 className="text-xs font-black uppercase tracking-widest text-primary flex items-center gap-2">
                      <Clock className="w-4 h-4" /> Temporal & Limits
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Start Time</label>
                        <input 
                          required
                          type="datetime-local" 
                          value={formData.start_at}
                          onChange={(e) => setFormData(prev => ({ ...prev, start_at: e.target.value }))}
                          className="w-full px-6 py-4 bg-slate-50 rounded-2xl border-none outline-none focus:ring-2 focus:ring-primary/20 font-bold text-xs" 
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">End Date</label>
                        <input 
                          type="date" 
                          value={formData.expires_at}
                          onChange={(e) => setFormData(prev => ({ ...prev, expires_at: e.target.value }))}
                          className="w-full px-6 py-4 bg-slate-50 rounded-2xl border-none outline-none focus:ring-2 focus:ring-primary/20 font-bold text-xs" 
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Utilization Limit</label>
                        <input 
                          required
                          type="number" 
                          value={formData.usage_limit}
                          onChange={(e) => {
                            const val = parseInt(e.target.value);
                            setFormData(prev => ({ ...prev, usage_limit: isNaN(val) ? 0 : val }));
                          }}
                          className="w-full px-6 py-4 bg-slate-50 rounded-2xl border-none outline-none focus:ring-2 focus:ring-primary/20 font-bold" 
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Predicted Impact (KES)</label>
                        <input 
                          required
                          type="number" 
                          value={formData.predicted_impact}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value);
                            setFormData(prev => ({ ...prev, predicted_impact: isNaN(val) ? 0 : val }));
                          }}
                          className="w-full px-6 py-4 bg-slate-50 rounded-2xl border-none outline-none focus:ring-2 focus:ring-primary/20 font-bold" 
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-xs font-black uppercase tracking-widest text-primary flex items-center gap-2">
                    <Briefcase className="w-4 h-4" /> Governance & Command Logic (JSON)
                  </h3>
                  <textarea 
                    value={formData.command_logic}
                    onChange={(e) => setFormData(prev => ({ ...prev, command_logic: e.target.value }))}
                    placeholder='{"auto_expire": true, "notify_users": false}'
                    className="w-full h-40 px-6 py-4 bg-slate-900 text-green-400 font-mono text-xs rounded-2xl border-none outline-none focus:ring-2 focus:ring-primary/20 custom-scrollbar"
                  />
                </div>

                <div className="flex gap-4 pt-4">
                  <button 
                    type="submit"
                    className="flex-1 bg-primary text-white py-6 rounded-[32px] font-black uppercase tracking-widest shadow-2xl shadow-primary/30 hover:scale-[1.02] active:scale-[0.98] transition-all"
                  >
                    {editingPromo ? 'Commit Protocol Changes' : 'Initialize Revenue Protocol'}
                  </button>
                  <button 
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-12 bg-slate-100 text-slate-600 py-6 rounded-[32px] font-black uppercase tracking-widest hover:bg-slate-200 transition-all"
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
