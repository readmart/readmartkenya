import { supabase } from '@/lib/supabase/client';

/**
 * Utility to calculate percentage trend between two periods
 */
function calculateTrend(current: number, previous: number): string {
  if (previous === 0) return current > 0 ? '+100%' : '0%';
  const diff = ((current - previous) / previous) * 100;
  return `${diff >= 0 ? '+' : ''}${diff.toFixed(1)}%`;
}

// --- Founder Services ---

/**
 * Fetch global analytics for Founders
 * Ensures data is fetched properly and securely from the database
 */
export async function getGlobalAnalytics() {
  try {
    // 0. Security Check: Verify user role before fetching sensitive data
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Authentication required');

    const { data: profile, error: roleError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', session.user.id)
      .single();

    if (roleError || !profile || (profile.role !== 'founder' && profile.role !== 'admin')) {
      throw new Error('Unauthorized access: Administrative privileges required');
    }

    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));
    const sixtyDaysAgo = new Date(now.getTime() - (60 * 24 * 60 * 60 * 1000));

    // 1. Fetch orders for the last 60 days to calculate trends
    // Selecting only required columns for security and performance
    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select('total_amount, created_at, status')
      .gte('created_at', sixtyDaysAgo.toISOString());

    if (ordersError) {
      console.error('Database Error (Orders):', ordersError);
      throw ordersError;
    }

    // 2. Fetch basic counts and trends for products and users
    const [
      profilesCountResult,
      productsCountResult,
      recentProductsResult,
      recentUsersResult
    ] = await Promise.all([
      supabase.from('profiles').select('*', { count: 'exact', head: true }),
      supabase.from('products').select('*', { count: 'exact', head: true }),
      supabase.from('products').select('created_at').gte('created_at', sixtyDaysAgo.toISOString()),
      supabase.from('profiles').select('created_at').gte('created_at', sixtyDaysAgo.toISOString())
    ]);

    // Check for errors in parallel queries
    if (profilesCountResult.error) throw profilesCountResult.error;
    if (productsCountResult.error) throw productsCountResult.error;
    if (recentProductsResult.error) throw recentProductsResult.error;
    if (recentUsersResult.error) throw recentUsersResult.error;

    const userCount = profilesCountResult.count;
    const productCount = productsCountResult.count;
    const productsData = recentProductsResult.data;
    const usersData = recentUsersResult.data;

    // Product trends
    const currentProducts = productsData?.filter(p => new Date(p.created_at) >= thirtyDaysAgo).length || 0;
    const previousProducts = productsData?.filter(p => new Date(p.created_at) < thirtyDaysAgo).length || 0;
    const productsTrend = calculateTrend(currentProducts, previousProducts);

    // User trends
    const currentUsers = usersData?.filter(u => new Date(u.created_at) >= thirtyDaysAgo).length || 0;
    const previousUsers = usersData?.filter(u => new Date(u.created_at) < thirtyDaysAgo).length || 0;
    const usersTrend = calculateTrend(currentUsers, previousUsers);

    // 3. Process revenue and order trends
    const currentOrders = orders?.filter(o => new Date(o.created_at) >= thirtyDaysAgo) || [];
    const previousOrders = orders?.filter(o => new Date(o.created_at) < thirtyDaysAgo) || [];

    // Revenue only from successful transactions
    const SUCCESS_STATUSES = ['completed', 'paid', 'delivered'];
    const completedOrders = currentOrders.filter(o => SUCCESS_STATUSES.includes(o.status.toLowerCase()));
    const currentRevenue = completedOrders.reduce((acc, curr) => acc + Number(curr.total_amount || 0), 0);
    
    const previousRevenue = previousOrders
      .filter(o => SUCCESS_STATUSES.includes(o.status.toLowerCase()))
      .reduce((acc, curr) => acc + Number(curr.total_amount || 0), 0);

    const revenueTrend = calculateTrend(currentRevenue, previousRevenue);
    const ordersTrend = calculateTrend(currentOrders.length, previousOrders.length);

    // 4. Detailed Metrics: AOV, Order Status, Low Stock
    const aov = currentOrders.length > 0 ? currentRevenue / currentOrders.length : 0;
    
    const orderStatusCount = currentOrders.reduce((acc: Record<string, number>, curr) => {
      const status = curr.status || 'unknown';
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {});

    const { data: lowStockProducts, error: lowStockError } = await supabase
      .from('products')
      .select('id, name, stock_quantity')
      .lt('stock_quantity', 10)
      .limit(10);

    if (lowStockError) console.error('Low Stock Fetch Error:', lowStockError);

    // 5. Book Club Stats - properly secured
    const { count: clubMembersCount, error: clubError } = await supabase
      .from('book_club_memberships')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true);

    if (clubError) console.error('Club Members Fetch Error:', clubError);

    // 6. Revenue by Category - Optimized processing
    const { data: categoryRevenueData, error: catRevError } = await supabase
      .from('order_items')
      .select('product_snapshot, quantity')
      .gte('created_at', thirtyDaysAgo.toISOString());

    if (catRevError) console.error('Category Revenue Fetch Error:', catRevError);

    const categoryRevenue: Record<string, number> = {};
    categoryRevenueData?.forEach(item => {
      const snapshot = item.product_snapshot as any;
      const category = snapshot?.category || 'Uncategorized';
      const revenue = Number(item.quantity || 0) * Number(snapshot?.price || 0);
      categoryRevenue[category] = (categoryRevenue[category] || 0) + revenue;
    });

    const categoryStats = Object.entries(categoryRevenue)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    // 7. Fetch Top Products (most sold) - Enhanced accuracy
    const productSales: Record<string, { name: string, quantity: number, revenue: number }> = {};
    categoryRevenueData?.forEach(item => {
      const snapshot = item.product_snapshot as any;
      const pid = snapshot?.id;
      if (!pid) return;
      
      if (!productSales[pid]) {
        productSales[pid] = {
          name: snapshot?.name || 'Unknown Product', 
          quantity: 0, 
          revenue: 0 
        };
      }
      productSales[pid].quantity += Number(item.quantity || 0);
      productSales[pid].revenue += Number(item.quantity || 0) * Number(snapshot?.price || 0);
    });

    const topProducts = Object.values(productSales)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);

    return {
      totalRevenue: currentRevenue,
      totalOrders: currentOrders.length,
      totalUsers: userCount || 0,
      totalProducts: productCount || 0,
      revenueTrend,
      ordersTrend,
      usersTrend,
      productsTrend,
      salesData: currentOrders,
      topProducts,
      aov,
      orderStatusCount,
      lowStockProducts: lowStockProducts || [],
      clubMembersCount: clubMembersCount || 0,
      categoryStats,
      isInitialized: true
    };
  } catch (error: any) {
    console.error('CRITICAL: Analytics fetch failed:', error.message);
    // Return empty but structured data on error to prevent UI crash
    return {
      totalRevenue: 0,
      totalOrders: 0,
      totalUsers: 0,
      totalProducts: 0,
      revenueTrend: '0%',
      ordersTrend: '0%',
      usersTrend: '0%',
      productsTrend: '0%',
      salesData: [],
      topProducts: [],
      aov: 0,
      orderStatusCount: {},
      lowStockProducts: [],
      clubMembersCount: 0,
      categoryStats: [],
      isInitialized: false,
      error: error.message
    };
  }
}

/**
 * Fetch all categories
 */
export async function getCategories() {
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .order('name');

  if (error) throw error;
  return data;
}

/**
 * Fetch all products for inventory management
 */
export async function getInventory() {
  const { data, error } = await supabase
    .from('products')
    .select('*, ebook_metadata(password, file_path, format)')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data;
}

/**
 * Create a new record in any table
 */
export async function createRecord(table: string, data: any) {
  const { data: result, error } = await supabase
    .from(table)
    .insert(data)
    .select()
    .single();

  if (error) throw error;
  return result;
}

/**
 * Update a record in any table
 */
export async function updateRecord(table: string, id: string, updates: any) {
  const { data: result, error } = await supabase
    .from(table)
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return result;
}

/**
 * Delete records from any table
 */
export async function deleteRecords(table: string, ids: string[]) {
  const { error } = await supabase
    .from(table)
    .delete()
    .in('id', ids);

  if (error) throw error;
  return true;
}

/**
 * Bulk update records in any table
 */
export async function bulkUpdateRecords(table: string, ids: string[], updates: any) {
  const { error } = await supabase
    .from(table)
    .update(updates)
    .in('id', ids);

  if (error) throw error;
  return true;
}

/**
 * Fetch all orders for management
 */
export async function getOrders() {
  try {
    const { data, error } = await supabase
      .from('orders')
      .select('*, profiles(full_name, email)')
      .order('created_at', { ascending: false });

    if (error) {
      if (error.code === '42P01' || error.code === 'PGRST116') {
        console.warn('Orders table not found or inaccessible');
        return [];
      }
      throw error;
    }
    return data || [];
  } catch (error: any) {
    console.warn('Orders fetch failed:', error.message);
    return [];
  }
}

/**
 * Fetch all shipping zones
 */
export async function getShippingZones() {
  try {
    const { data, error } = await supabase
      .from('shipping_zones')
      .select('*')
      .order('name');

    if (error) {
      if (error.code === '42P01' || error.code === 'PGRST116') {
        console.warn('Shipping zones table not found or inaccessible');
        return [];
      }
      throw error;
    }
    return data || [];
  } catch (error: any) {
    console.warn('Shipping zones fetch failed:', error.message);
    return [];
  }
}

/**
 * Fetch all promo codes
 */
export async function getPromos() {
  try {
    const { data, error } = await supabase
      .from('promos')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      if (error.code === '42P01' || error.code === 'PGRST116') {
        console.warn('Promos table not found or inaccessible');
        return [];
      }
      throw error;
    }
    return data || [];
  } catch (error: any) {
    console.warn('Promos fetch failed:', error.message);
    return [];
  }
}

/**
 * Fetch CMS content (banners, etc.)
 */
export async function getCMSContent() {
  try {
    const { data, error } = await supabase
      .from('cms_content')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      if (error.code === '42P01' || error.code === 'PGRST116') {
        console.warn('CMS content table not found or inaccessible');
        return [];
      }
      throw error;
    }
    return data || [];
  } catch (error: any) {
    console.warn('CMS content fetch failed:', error.message);
    return [];
  }
}

/**
 * Fetch audit logs for Founders
 */
export async function getAuditLogs() {
  try {
    const { data, error } = await supabase
      .from('audit_logs')
      .select('*, profiles(full_name)')
      .order('created_at', { ascending: false });

    if (error) {
      if (error.code === '42P01' || error.code === 'PGRST116') {
        console.warn('Audit logs table not found or inaccessible');
        return [];
      }
      throw error;
    }
    return data || [];
  } catch (error: any) {
    console.warn('Audit logs fetch failed:', error.message);
    return [];
  }
}

/**
 * Fetch all contact inquiries
 */
export async function getInquiries() {
  try {
    const { data, error } = await supabase
      .from('contact_messages')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      if (error.code === '42P01' || error.code === 'PGRST116') {
        console.warn('Contact messages table not found or inaccessible');
        return [];
      }
      throw error;
    }
    return data || [];
  } catch (error: any) {
    console.warn('Inquiries fetch failed:', error.message);
    return [];
  }
}

/**
 * Fetch all partnership applications
 */
export async function getPartnerships() {
  try {
    const { data, error } = await supabase
      .from('partnership_applications')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      if (error.code === '42P01' || error.code === 'PGRST116') {
        console.warn('Partnership applications table not found or inaccessible');
        return [];
      }
      throw error;
    }
    return data || [];
  } catch (error: any) {
    console.warn('Partnerships fetch failed:', error.message);
    return [];
  }
}

/**
 * Fetch site settings
 */
export async function getSiteSettings() {
  try {
    const { data, error } = await supabase
      .from('settings')
      .select('*')
      .maybeSingle();

    if (error) throw error;
    if (!data) throw new Error('No settings found');
    return data;
  } catch (error) {
    console.warn('Site settings table might not exist or is empty, returning defaults');
    return {
      tax_rate: 16,
      default_currency: 'KES',
      site_name: 'READMART',
      whatsapp_link: 'https://wa.me/254794129958',
      address: 'Nairobi, Kenya',
      maintenance_mode: false,
      instagram_url: 'https://instagram.com/readmartke',
      facebook_url: 'https://facebook.com/readmartke',
      twitter_url: 'https://x.com/readmartke',
      linkedin_url: 'https://linkedin.com/company/readmartke',
      announcement_text: ''
    };
  }
}

/**
 * Fetch team members (users with admin/manager roles)
 */
export async function getTeamMembers() {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .in('role', ['founder', 'admin', 'manager'])
      .order('created_at', { ascending: false });

    if (error) {
      if (error.code === '42P01' || error.code === 'PGRST116') {
        console.warn('Profiles table not found or inaccessible for team members');
        return [];
      }
      throw error;
    }
    return data || [];
  } catch (error: any) {
    console.warn('Team members fetch failed:', error.message);
    return [];
  }
}

/**
 * Fetch sales report for a specific author
 */
export async function getAuthorSalesReport(authorId: string) {
  try {
    const { data, error } = await supabase
      .from('orders')
      .select('*, order_items!inner(*)')
      .eq('order_items.author_id', authorId)
      .order('created_at', { ascending: false });

    if (error) {
      if (error.code === '42P01' || error.code === 'PGRST116') {
        console.warn('Orders/OrderItems table not found or inaccessible for author report');
        return [];
      }
      throw error;
    }
    return data || [];
  } catch (error: any) {
    console.warn('Author sales report fetch failed:', error.message);
    return [];
  }
}

/**
 * Fetch payouts for a specific partner
 */
export async function getPartnerPayouts(partnerId: string) {
  try {
    const { data, error } = await supabase
      .from('fulfillment_ledger')
      .select('*')
      .eq('partner_service_id', partnerId)
      .order('created_at', { ascending: false });

    if (error) {
      if (error.code === '42P01' || error.code === 'PGRST116') {
        console.warn('Fulfillment ledger table not found or inaccessible');
        return [];
      }
      throw error;
    }
    return data || [];
  } catch (error: any) {
    console.warn('Partner payouts fetch failed:', error.message);
    return [];
  }
}

/**
 * Fetch all users for Admin management
 */
export async function getAllUsers() {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      if (error.code === '42P01' || error.code === 'PGRST116') {
        console.warn('Profiles table not found or inaccessible for all users');
        return [];
      }
      throw error;
    }
    return data || [];
  } catch (error: any) {
    console.warn('All users fetch failed:', error.message);
    return [];
  }
}

/**
 * Update a user's role (Admin only)
 */
export async function updateUserRole(userId: string, role: string) {
  const { error } = await supabase
    .from('profiles')
    .update({ role })
    .eq('id', userId);

  if (error) throw error;
  return true;
}

/**
 * Update a user's active status
 */
export async function updateUserStatus(userId: string, isActive: boolean) {
  const { error } = await supabase
    .from('profiles')
    .update({ is_active: isActive })
    .eq('id', userId);

  if (error) throw error;
  return true;
}

// --- CRUD Operations ---

/**
 * Update CMS content
 */
export async function updateCMSContent(id: string, updates: any) {
  const { data, error } = await supabase
    .from('cms_content')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Create new CMS content
 */
export async function createCMSContent(content: any) {
  const { data, error } = await supabase
    .from('cms_content')
    .insert(content)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Delete any record from a table
 */
export async function deleteRecord(table: string, id: string) {
  const { error } = await supabase
    .from(table)
    .delete()
    .eq('id', id);

  if (error) throw error;
  return true;
}

/**
 * Create a new product
 */
export async function createProduct(product: any) {
  const { data, error } = await supabase
    .from('products')
    .insert(product)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Update product inventory
 */
export async function updateProduct(id: string, updates: any) {
  const { error } = await supabase
    .from('products')
    .update(updates)
    .eq('id', id);

  if (error) throw error;
  return true;
}

/**
 * Bulk update products
 */
export async function bulkUpdateProducts(ids: string[], updates: any) {
  const { error } = await supabase
    .from('products')
    .update(updates)
    .in('id', ids);

  if (error) throw error;
  return true;
}

/**
 * Update order status
 */
export async function updateOrderStatus(id: string, status: string) {
  const { error } = await supabase
    .from('orders')
    .update({ status })
    .eq('id', id);

  if (error) throw error;
  return true;
}

/**
 * Update site settings
 */
export async function updateSiteSettings(updates: any) {
  // Use upsert to handle both creation and update of the global settings row
  const { error } = await supabase
    .from('settings')
    .upsert({ 
      id: 'global', // We use a fixed ID for the single settings row
      ...updates,
      updated_at: new Date().toISOString()
    })
    .eq('id', 'global');

  if (error) throw error;
  return true;
}

/**
 * Toggle promo status
 */
export async function togglePromoStatus(id: string, isActive: boolean) {
  const { error } = await supabase
    .from('promos')
    .update({ is_active: isActive })
    .eq('id', id);

  if (error) throw error;
  return true;
}
