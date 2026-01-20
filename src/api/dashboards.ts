import { supabase } from '@/lib/supabase/client';

/**
 * Utility to calculate percentage trend between two periods
 */
function calculateTrend(current: number, previous: number): string {
  if (previous === 0) return current > 0 ? '+100%' : '0%';
  const diff = ((current - previous) / previous) * 100;
  return `${diff >= 0 ? '+' : ''}${diff.toFixed(1)}%`;
}

/**
 * Utility to verify administrative privileges
 */
async function verifyAdmin() {
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
  return session;
}

// --- Founder Services ---

/**
 * Fetch global analytics for Founders
 * Ensures data is fetched properly and securely from the database
 */
export async function getGlobalAnalytics() {
  try {
    // 0. Security Check
    await verifyAdmin();

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
      .select('id, title, stock_quantity')
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
      .select('product_snapshot, quantity, orders!inner(created_at)')
      .gte('orders.created_at', thirtyDaysAgo.toISOString());

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
    const productSales: Record<string, { title: string, quantity: number, revenue: number }> = {};
    categoryRevenueData?.forEach(item => {
      const snapshot = item.product_snapshot as any;
      const pid = snapshot?.id;
      if (!pid) return;
      
      if (!productSales[pid]) {
        productSales[pid] = {
          title: snapshot?.title || 'Unknown Product', 
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
 * Trigger abandoned cart reminders
 */
export async function sendAbandonedCartReminders() {
  await verifyAdmin();

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Authentication required');

  const response = await fetch('/api/reminders', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${session.access_token}`,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to send reminders');
  }

  return await response.json();
}

/**
 * Fetch all shipping zones (for management)
 */
export async function getShippingZones() {
  await verifyAdmin();
  const { data, error } = await supabase
    .from('shipping_zones')
    .select('*')
    .order('name');

  if (error) throw error;
  return data;
}

// --- Generic CRUD Utilities ---

/**
 * Fetch all records from a table with optional ordering
 */
async function getAllRecords(table: string, orderBy: string = 'created_at') {
  await verifyAdmin();
  const { data, error } = await supabase
    .from(table)
    .select('*')
    .order(orderBy, { ascending: false });

  if (error) throw error;
  return data;
}

export async function getInventory() {
  await verifyAdmin();
  const { data, error } = await supabase
    .from('products')
    .select('*, category:categories(name), ebook_metadata(*)')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data;
}

export async function getOrders() {
  await verifyAdmin();
  return getAllRecords('orders');
}

export async function getAllUsers() {
  await verifyAdmin();
  return getAllRecords('profiles');
}

export async function getCMSContent() {
  await verifyAdmin();
  return getAllRecords('cms_content');
}

export async function getClubs() {
  await verifyAdmin();
  const { data, error } = await supabase
    .from('cms_content')
    .select('*')
    .eq('type', 'book_club')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data;
}

export async function getEvents() {
  await verifyAdmin();
  const { data, error } = await supabase
    .from('cms_content')
    .select('*')
    .eq('type', 'event')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data;
}

export async function getBanners() {
  await verifyAdmin();
  const { data, error } = await supabase
    .from('cms_content')
    .select('*')
    .eq('type', 'banner')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data;
}

export async function getPromos() {
  await verifyAdmin();
  return getAllRecords('promos');
}

export async function getAuditLogs() {
  await verifyAdmin();
  return getAllRecords('audit_logs');
}

export async function getInquiries() {
  await verifyAdmin();
  return getAllRecords('contact_messages');
}

export async function getAuthorSalesReport(authorId: string) {
  await verifyAdmin();
  // This is a placeholder that will be expanded when we have the sales/orders logic for authors
  const { data, error } = await supabase
    .from('order_items')
    .select(`
      *,
      order:orders(status, created_at),
      product:products(title, metadata)
    `)
    .eq('product:products.metadata->>author_id', authorId);
  
  if (error) throw error;
  return data;
}

export async function getPartnerships() {
  await verifyAdmin();
  return getAllRecords('partnership_applications');
}

export async function getAuthors() {
  await verifyAdmin();
  return getAllRecords('author_applications');
}

export async function getCategories() {
  await verifyAdmin();
  return getAllRecords('categories', 'name');
}

export async function getSiteSettings() {
  await verifyAdmin();
  const { data, error } = await supabase
    .from('site_settings')
    .select('*')
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data || {};
}

/**
 * Generic Create
 */
export async function createRecord(table: string, record: any) {
  await verifyAdmin();
  const { data, error } = await supabase
    .from(table)
    .insert([record])
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Generic Update
 */
export async function updateRecord(table: string, id: string, updates: any) {
  await verifyAdmin();
  const { data, error } = await supabase
    .from(table)
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Generic Delete
 */
export async function deleteRecord(table: string, id: string) {
  await verifyAdmin();
  const { error } = await supabase
    .from(table)
    .delete()
    .eq('id', id);

  if (error) throw error;
  return true;
}

/**
 * Generic Bulk Delete
 */
export async function deleteRecords(table: string, ids: string[]) {
  await verifyAdmin();
  const { error } = await supabase
    .from(table)
    .delete()
    .in('id', ids);

  if (error) throw error;
  return true;
}

// --- Specialized Update Services ---

export async function updateOrderStatus(orderId: string, status: string) {
  await verifyAdmin();
  return updateRecord('orders', orderId, { status });
}

export async function togglePromoStatus(promoId: string, isActive: boolean) {
  await verifyAdmin();
  return updateRecord('promos', promoId, { is_active: isActive });
}

export async function updateUserStatus(userId: string, isActive: boolean) {
  await verifyAdmin();
  return updateRecord('profiles', userId, { is_active: isActive });
}

export async function updateSiteSettings(settings: any) {
  await verifyAdmin();
  const { data: existing } = await supabase.from('site_settings').select('id').single();
  
  if (existing) {
    return updateRecord('site_settings', existing.id, settings);
  } else {
    return createRecord('site_settings', settings);
  }
}

export async function updateCMSContent(id: string, content: any) {
  await verifyAdmin();
  return updateRecord('cms_content', id, content);
}

export async function createCMSContent(content: any) {
  await verifyAdmin();
  return createRecord('cms_content', content);
}

export async function createProduct(product: any) {
  await verifyAdmin();
  const { ebook_metadata, ...productData } = product;
  
  const { data, error } = await supabase
    .from('products')
    .insert([productData])
    .select()
    .single();

  if (error) throw error;

  if (productData.type === 'ebook' && ebook_metadata) {
    await supabase.from('ebook_metadata').insert([{
      ...ebook_metadata,
      product_id: data.id
    }]);
  }

  return data;
}

export async function updateProduct(id: string, product: any) {
  await verifyAdmin();
  const { ebook_metadata, ...productData } = product;

  const { data, error } = await supabase
    .from('products')
    .update(productData)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;

  if (productData.type === 'ebook' && ebook_metadata) {
    const { data: existing } = await supabase
      .from('ebook_metadata')
      .select('id')
      .eq('product_id', id)
      .maybeSingle();

    if (existing) {
      await supabase
        .from('ebook_metadata')
        .update(ebook_metadata)
        .eq('id', existing.id);
    } else {
      await supabase
        .from('ebook_metadata')
        .insert([{
          ...ebook_metadata,
          product_id: id
        }]);
    }
  }

  return data;
}

export async function bulkUpdateProducts(ids: string[], updates: any) {
  await verifyAdmin();
  const { data, error } = await supabase
    .from('products')
    .update(updates)
    .in('id', ids)
    .select();

  if (error) throw error;
  return data;
}
