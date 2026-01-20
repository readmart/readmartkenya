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
 * Utility to verify roles
 */
export async function verifyRole(allowedRoles: string[]) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');

  // Development bypass: Check localStorage for dev role
  // This matches the logic in AuthContext.tsx
  if (typeof window !== 'undefined') {
    const devRole = localStorage.getItem('rm_dev_role');
    if (devRole && allowedRoles.includes(devRole)) {
      return session; // Authorized via dev bypass
    }
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', session.user.id)
    .single();

  if (!profile || !allowedRoles.includes(profile.role)) {
    throw new Error('Unauthorized access: Required privileges missing');
  }
  return session;
}

/**
 * Utility to verify administrative privileges
 */
async function verifyAdmin() {
  return verifyRole(['founder', 'admin']);
}

/**
 * Utility to verify partner privileges
 */
async function verifyPartner() {
  return verifyRole(['founder', 'admin', 'partner']);
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
  try {
    await verifyAdmin();
    const { data, error } = await supabase
      .from('shipping_zones')
      .select('*')
      .order('name');

    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error('Shipping Zones fetch failed:', err);
    return [];
  }
}

// --- Generic CRUD Utilities ---

/**
 * Fetch all records from a table with optional ordering
 */
async function getAllRecords(table: string, orderBy: string = 'created_at') {
  const { data, error } = await supabase
    .from(table)
    .select('*')
    .order(orderBy, { ascending: false });

  if (error) throw error;
  return data;
}

export async function getInventory(authorId?: string) {
  try {
    // If authorId is provided, we verify author role, otherwise admin/founder
    if (authorId) {
      await verifyRole(['author', 'admin', 'founder']);
    } else {
      await verifyAdmin();
    }

    let query = supabase
      .from('products')
      .select('*, category:categories(name), ebook_metadata(*)')
      .order('created_at', { ascending: false });

    if (authorId) {
      query = query.eq('author_id', authorId);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching inventory:', error);
      return [];
    }
    return data || [];
  } catch (err) {
    console.error('Inventory fetch failed:', err);
    return [];
  }
}

export async function getOrders() {
  try {
    await verifyPartner();
    return await getAllRecords('orders');
  } catch (err) {
    console.error('Orders fetch failed:', err);
    return [];
  }
}

export async function getAllUsers() {
  try {
    await verifyAdmin();
    return await getAllRecords('profiles');
  } catch (err) {
    console.error('Users fetch failed:', err);
    return [];
  }
}

export async function getCMSContent() {
  try {
    await verifyAdmin();
    return await getAllRecords('cms_content');
  } catch (err) {
    console.error('CMS Content fetch failed:', err);
    return [];
  }
}

export async function getClubs() {
  try {
    await verifyAdmin();
    const { data, error } = await supabase
      .from('cms_content')
      .select('*')
      .eq('type', 'book_club')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error('Clubs fetch failed:', err);
    return [];
  }
}

export async function getEvents() {
  try {
    await verifyAdmin();
    const { data, error } = await supabase
      .from('cms_content')
      .select('*')
      .eq('type', 'event')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error('Events fetch failed:', err);
    return [];
  }
}

export async function getBanners() {
  try {
    await verifyAdmin();
    const { data, error } = await supabase
      .from('cms_content')
      .select('*')
      .eq('type', 'banner')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error('Banners fetch failed:', err);
    return [];
  }
}

export async function getPromos() {
  try {
    await verifyAdmin();
    return await getAllRecords('promos');
  } catch (err) {
    console.error('Promos fetch failed:', err);
    return [];
  }
}

export async function getAuditLogs() {
  try {
    await verifyAdmin();
    return await getAllRecords('audit_logs');
  } catch (err) {
    console.error('Audit Logs fetch failed:', err);
    return [];
  }
}

export async function getInquiries() {
  try {
    await verifyAdmin();
    return await getAllRecords('contact_messages');
  } catch (err) {
    console.error('Inquiries fetch failed:', err);
    return [];
  }
}

export async function getAuthorSalesReport(authorId: string) {
  try {
    await verifyAdmin();
    // Use the author_id column on products table instead of metadata
    const { data, error } = await supabase
      .from('order_items')
      .select(`
        *,
        order:orders(status, created_at),
        product:products!inner(title, author_id)
      `)
      .eq('product.author_id', authorId);
    
    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error('Author Sales Report fetch failed:', err);
    return [];
  }
}

export async function getPartnerPayouts(partnerId: string) {
  try {
    await verifyPartner();
    
    // We filter by partner_id which links directly to the partner's profile
    const { data, error } = await supabase
      .from('fulfillment_ledger')
      .select(`
        *,
        order:orders(customer_name, status)
      `)
      .eq('partner_id', partnerId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error('Partner Payouts fetch failed:', err);
    return [];
  }
}

export async function getPartnerships() {
  try {
    await verifyAdmin();
    return await getAllRecords('partnership_applications');
  } catch (err) {
    console.error('Partnerships fetch failed:', err);
    return [];
  }
}

export async function getAuthors() {
  try {
    await verifyAdmin();
    return await getAllRecords('author_applications');
  } catch (err) {
    console.error('Authors fetch failed:', err);
    return [];
  }
}

export async function getApprovedAuthors() {
  try {
    await verifyAdmin();
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, email')
      .eq('role', 'author')
      .order('full_name');
    
    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error('Approved Authors fetch failed:', err);
    return [];
  }
}

export async function getCategories() {
  try {
    await verifyAdmin();
    return await getAllRecords('categories', 'name');
  } catch (err) {
    console.error('Categories fetch failed:', err);
    return [];
  }
}

export async function getSiteSettings() {
  try {
    await verifyAdmin();
    // Try site_settings first, then fall back to settings
    const { data: siteData, error: siteError } = await supabase
      .from('site_settings')
      .select('*')
      .maybeSingle();

    if (!siteError && siteData) return siteData;

    const { data: legacyData, error: legacyError } = await supabase
      .from('settings')
      .select('*')
      .maybeSingle();

    if (!legacyError && legacyData) return legacyData;

    return {};
  } catch (err) {
    console.error('Site Settings fetch failed:', err);
    return {};
  }
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

/**
 * Generate a URL-friendly slug from a string
 */
function generateSlug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '') // Remove non-word characters
    .replace(/[\s_-]+/g, '-') // Replace spaces and underscores with hyphens
    .replace(/^-+|-+$/g, ''); // Trim hyphens
}

export async function createProduct(product: any) {
  await verifyAdmin();
  const { ebook_metadata, ...productData } = product;
  
  // Ensure slug exists
  if (!productData.slug && productData.title) {
    productData.slug = `${generateSlug(productData.title)}-${Math.random().toString(36).substring(2, 7)}`;
  }
  
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
