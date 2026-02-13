import { supabase } from '@/lib/supabase/client';
import { withRetry } from '@/lib/retry';
import { 
  logAudit, 
  calculateTrend, 
  verifyRole, 
  verifyAdmin, 
  verifyAuthor,
  verifyPartner 
} from '@/lib/utils/api-helpers';
import { deleteProductImage, deleteEbookFile } from './storage';

export interface Profile {
  id: string;
  created_at: string;
  full_name?: string;
  email?: string;
  role?: string;
  avatar_url?: string;
}

export interface Product {
  id: string;
  created_at: string;
  title?: string;
  image_url?: string;
  author_id?: string;
  stock_quantity?: number;
  category?: { name: string } | string;
  category_name?: string;
  price?: number;
}

export interface Order {
  id: string;
  created_at: string;
  is_paid: boolean;
  status: string;
  total_amount: number;
  subtotal_amount: number;
  shipping_amount: number;
  tax_amount: number;
  shipping_address: any; // Define a more specific type if available
  profiles: { full_name: string; email: string };
  order_items: OrderItem[];
}

export interface Transaction {
  id: string;
  created_at: string;
  amount: number;
  status: string;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  price_at_purchase: number;
  created_at: string;
  product_snapshot: Product;
  orders?: Order; // Optional, as it's sometimes joined
  product?: Product; // Optional, as it's sometimes joined
}

export interface ShippingZone {
  id: string;
  created_at: string;
  name: string;
  country_code: string;
  estimated_days: number;
  shipping_method: string;
  weight_surcharge: number;
  volume_surcharge: number;
  price: number;
  partner_id?: string;
}

export interface UnifiedProductSale {
  title: string;
  quantity: number;
  revenue: number;
}

export type NewsletterStatus = 'subscribed' | 'unsubscribed' | 'bounced' | 'active';

export interface NewsletterSubscription {
  id: string;
  created_at: string;
  email: string;
  status: NewsletterStatus;
}

export async function getNewsletterSubscriptions() {
  await verifyAdmin();
  return withRetry(async () => {
    const { data, error } = await supabase
      .from('newsletter_subscriptions')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data as NewsletterSubscription[];
  });
}

export async function updateNewsletterStatus(id: string, status: NewsletterStatus) {
  await verifyAdmin();
  return withRetry(async () => {
    const { data, error } = await supabase
      .from('newsletter_subscriptions')
      .update({ status })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    await logAudit('update_newsletter_status', 'newsletter_subscriptions', JSON.stringify({ id, status }));
    return data as NewsletterSubscription;
  });
}

export async function batchUpdateNewsletterStatus(ids: string[], status: NewsletterStatus) {
  await verifyAdmin();
  return withRetry(async () => {
    const { data, error } = await supabase
      .from('newsletter_subscriptions')
      .update({ status })
      .in('id', ids)
      .select();
    if (error) throw error;
    await logAudit('batch_update_newsletter_status', 'newsletter_subscriptions', JSON.stringify({ ids, status }));
    return data as NewsletterSubscription[];
  });
}

// --- Utilities ---

/**
 * Simple slug generator
 */


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
      .select('id, created_at, is_paid, total_amount, status')
      .gte('created_at', sixtyDaysAgo.toISOString());

    if (ordersError) {
      if (ordersError.code === 'PGRST204' || ordersError.message?.includes('cache')) {
        console.warn('Orders schema cache issue, retrying with minimal select');
        const { data: fallbackOrders, error: fallbackError } = await supabase
          .from('orders')
          .select('id, created_at, is_paid')
          .gte('created_at', sixtyDaysAgo.toISOString());
        if (fallbackError) throw fallbackError;
        (orders as any) = fallbackOrders;
      } else {
        console.error('Database Error (Orders):', ordersError);
        throw ordersError;
      }
    }

    // 2. Fetch basic counts and trends for products and users
    const [
      profilesCountResult,
      productsCountResult,
      recentProductsResult,
      recentUsersResult
    ] = await Promise.allSettled([
      supabase.from('profiles').select('id', { count: 'exact', head: true }),
      supabase.from('products').select('id', { count: 'exact', head: true }),
      supabase.from('products').select('id, created_at').gte('created_at', sixtyDaysAgo.toISOString()),
      supabase.from('profiles').select('id, created_at').gte('created_at', sixtyDaysAgo.toISOString())
    ]);

    // Check for results in parallel queries
    const profilesCount = profilesCountResult.status === 'fulfilled' ? profilesCountResult.value : { count: 0, error: null };
    const productsCount = productsCountResult.status === 'fulfilled' ? productsCountResult.value : { count: 0, error: null };
    const recentProducts = recentProductsResult.status === 'fulfilled' ? recentProductsResult.value : { data: [], error: null };
    const recentUsers = recentUsersResult.status === 'fulfilled' ? recentUsersResult.value : { data: [], error: null };

    if (profilesCount.error) console.error('Error fetching profiles count:', profilesCount.error);
    if (productsCount.error) console.error('Error fetching products count:', productsCount.error);
    if (recentProducts.error) console.error('Error fetching recent products:', recentProducts.error);
    if (recentUsers.error) console.error('Error fetching recent users:', recentUsers.error);

    const userCount = profilesCount.count || 0;
    const productCount = productsCount.count || 0;
    const productsData = (recentProducts.data as any[]) || [];
    const usersData = (recentUsers.data as any[]) || [];

    // Product trends
    const currentProducts = productsData?.filter((p: any) => new Date(p.created_at) >= thirtyDaysAgo).length || 0;
    const previousProducts = productsData?.filter((p: any) => new Date(p.created_at) < thirtyDaysAgo).length || 0;
    const productsTrend = calculateTrend(currentProducts, previousProducts);

    // User trends
    const currentUsers = usersData?.filter((u: any) => new Date(u.created_at) >= thirtyDaysAgo).length || 0;
    const previousUsers = usersData?.filter((u: any) => new Date(u.created_at) < thirtyDaysAgo).length || 0;
    const usersTrend = calculateTrend(currentUsers, previousUsers);

    // 3. Process revenue and order trends
    // Use the 'transactions' table for actual paid revenue from webhooks
    const { data: transactions, error: txError } = await supabase
      .from('transactions')
      .select('id, created_at, amount, status')
      .eq('status', 'completed')
      .gte('created_at', sixtyDaysAgo.toISOString());

    if (txError) {
      if (txError.code === 'PGRST204' || txError.message?.includes('cache') || txError.code === '42P01') {
        console.warn('Transactions table issues, falling back to orders for revenue calculation');
      } else {
        console.error('Database Error (Transactions):', txError);
      }
    }

    // Filter paid orders for accurate count (webhook verified)
    const currentPaidOrders = (orders as any[])?.filter((o: any) => o.is_paid === true && new Date(o.created_at) >= thirtyDaysAgo) || [];
    const previousPaidOrders = (orders as any[])?.filter((o: any) => o.is_paid === true && new Date(o.created_at) < thirtyDaysAgo) || [];

    // Revenue from actual completed transactions (webhooks)
    const currentTx = (transactions as any[])?.filter((t: any) => new Date(t.created_at) >= thirtyDaysAgo) || [];
    const previousTx = (transactions as any[])?.filter((t: any) => new Date(t.created_at) < thirtyDaysAgo) || [];

    const currentRevenue = currentTx.reduce((acc: number, curr: Transaction) => {
      const val = Number(curr.amount);
      return acc + (isNaN(val) ? 0 : val);
    }, 0);
    
    const previousRevenue = previousTx.reduce((acc: number, curr: Transaction) => {
      const val = Number(curr.amount);
      return acc + (isNaN(val) ? 0 : val);
    }, 0);

    const revenueTrend = calculateTrend(currentRevenue, previousRevenue);
    const ordersTrend = calculateTrend(currentPaidOrders.length, previousPaidOrders.length);

    // Group sales data by day for the trajectory chart based on completed transactions
    const salesByDay: Record<string, number> = {};
    currentTx.forEach((tx: Transaction) => {
      const day = new Date(tx.created_at).toISOString().split('T')[0];
      const val = Number(tx.amount);
      salesByDay[day] = (salesByDay[day] || 0) + (isNaN(val) ? 0 : val);
    });

    const trajectoryData = Object.entries(salesByDay)
      .map(([date, amount]) => ({ 
        created_at: date, 
        total_amount: amount 
      }))
      .sort((a, b) => a.created_at.localeCompare(b.created_at));

    // 4. Detailed Metrics: AOV, Order Status, Low Stock
    const aov = currentPaidOrders.length > 0 ? currentRevenue / currentPaidOrders.length : 0;
    
    const orderStatusCount = currentPaidOrders.reduce((acc: Record<string, number>, curr: Order) => {
      const status = curr.status || 'unknown';
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {});

    const { data: lowStockProducts, error: lowStockError } = await supabase
      .from('products')
      .select('id, title, stock_quantity, price, image_url')
      .lt('stock_quantity', 10)
      .limit(10);

    if (lowStockError) console.error('Low Stock Fetch Error:', lowStockError);

    // 5. Book Club Stats - properly secured
    let clubMembersCount = 0;
    try {
      const { count, error: clubError } = await supabase
        .from('book_club_members')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'active');
      
      if (clubError) throw clubError;
      clubMembersCount = count || 0;
    } catch (err) {
      console.warn('Club Members Fetch Error:', err);
    }

    // 6. Analytics Processing (Categories & Top Products)
    let categoryStats: { name: string; value: number }[] = [];
    const unifiedProductSales: Record<string, { title: string, quantity: number, revenue: number }> = {};
    const unifiedCategoryRevenue: Record<string, number> = {};

    try {
      const { data: unifiedData, error: unifiedError } = await withRetry(async () => {
        const { data, error } = await supabase
          .from('order_items')
          .select(`
            *,
            orders!inner(*)
          `)
          .filter('orders.created_at', 'gte', thirtyDaysAgo.toISOString());
        
        if (error && (error.code === 'PGRST204' || error.message?.includes('column'))) {
           console.warn('[API] Schema mismatch in unified analytics, retrying with minimal select...');
           return await supabase
            .from('order_items')
            .select(`
              id,
              quantity,
              unit_price,
              price_at_purchase,
              product_snapshot,
              orders!inner(id, created_at, is_paid, status)
            `)
            .filter('orders.created_at', 'gte', thirtyDaysAgo.toISOString());
        }
        return { data, error };
      });

      if (unifiedError) {
        console.error('Unified Analytics Query Error:', unifiedError);
        throw unifiedError;
      }

      unifiedData?.forEach((item: OrderItem) => {
        const order = item.orders as any;
        const orderStatus = order?.status?.toLowerCase() || 'pending';
        const isPaid = order?.is_paid === true;
        
        // Only count revenue from paid orders (webhook verified)
        if (!isPaid || ['cancelled', 'failed', 'refunded'].includes(orderStatus)) return;

        const snapshot = item.product_snapshot as any;
        const pid = snapshot?.id || 'unknown';
        const category = snapshot?.category?.name || snapshot?.category || snapshot?.category_name || 'Uncategorized';
        const price = Number(item.price_at_purchase || snapshot?.price || 0);
        const qty = Number(item.quantity || 0);
        const revenue = isNaN(price) || isNaN(qty) ? 0 : qty * price;

        // Update Categories
        unifiedCategoryRevenue[category] = (unifiedCategoryRevenue[category] || 0) + revenue;

        // Update Products
        if (!unifiedProductSales[pid]) {
          unifiedProductSales[pid] = {
            title: snapshot?.title || 'Unknown Product',
            quantity: 0,
            revenue: 0
          };
        }
        unifiedProductSales[pid].quantity += qty;
        unifiedProductSales[pid].revenue += revenue;
      });

      categoryStats = Object.entries(unifiedCategoryRevenue)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value);
    } catch (err) {
      console.warn('Unified Analytics Processing Error:', err);
    }

    const topProducts = Object.values(unifiedProductSales)
      .sort((a: UnifiedProductSale, b: UnifiedProductSale) => b.revenue - a.revenue)
      .slice(0, 5);

    return {
      totalRevenue: currentRevenue,
      totalOrders: currentPaidOrders.length,
      totalUsers: userCount || 0,
      totalProducts: productCount || 0,
      revenueTrend,
      ordersTrend,
      usersTrend,
      productsTrend,
      salesData: trajectoryData,
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
      'Content-Type': 'application/json',
      'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY
    }
  });

  const text = await response.text();
  
  if (!response.ok) {
    let errorMsg = 'Failed to send reminders';
    try {
      const error = JSON.parse(text);
      errorMsg = error.error || errorMsg;
    } catch (e) {
      errorMsg = `HTTP ${response.status}: ${text.slice(0, 100)}`;
    }
    throw new Error(errorMsg);
  }

  try {
    return JSON.parse(text);
  } catch (e) {
    return { success: true }; // Fallback for empty/non-json success
  }
}

/**
 * Fetch all shipping zones (for checkout selection)
 */
export async function getShippingZones() {
  return withRetry(async () => {
    try {
      // Use select('*') for robustness against schema changes
      const { data, error } = await supabase
        .from('shipping_zones')
        .select('*')
        .order('name');

      if (error) {
        throw error;
      }
      
      // Normalize the data to ensure 'price' is always present and other fields have defaults
      const normalizedData = (data || []).map((zone: ShippingZone) => {
        // Handle different column names for price (legacy support)
        const price = (zone as any).price ?? (zone as any).rate ?? (zone as any).base_rate ?? 0;
        return {
          ...zone,
          country_code: zone.country_code || 'KE',
          estimated_days: zone.estimated_days || 3,
          shipping_method: zone.shipping_method || 'Standard',
          weight_surcharge: zone.weight_surcharge || 0,
          volume_surcharge: zone.volume_surcharge || 0,
          price
        };
      });

      console.log(`Fetched ${normalizedData.length} shipping zones`);
      return normalizedData;
    } catch (err) {
      console.error('Shipping Zones fetch failed:', err);
      return [];
    }
  });
}

// --- Generic CRUD Utilities ---

/**
 * Fetch all records from a table with optional ordering
 * Hardened to handle missing tables (404/PGRST116)
 */
async function getAllRecords(table: string, orderBy: string = 'created_at') {
  return withRetry(async () => {
    try {
      // For shipping_zones, explicitly select columns to avoid schema cache issues
      let query;
      if (table === 'shipping_zones') {
        query = supabase
          .from(table)
          .select('*');
      } else if (table === 'profiles') {
        query = supabase
          .from(table)
          .select('id, full_name, email, role, avatar_url, created_at');
      } else if (table === 'newsletter_subscriptions') {
        query = supabase
          .from(table)
          .select('id, email, status, created_at');
      } else if (table === 'partnership_applications') {
        query = supabase
          .from(table)
          .select('id, full_name, email, company_name, status, created_at');
      } else if (table === 'author_applications') {
        query = supabase
          .from(table)
          .select('id, full_name, email, status, created_at');
      } else if (table === 'contact_messages') {
        query = supabase
          .from(table)
          .select('id, full_name, email, subject, status, created_at');
      } else if (table === 'audit_logs') {
        query = supabase
          .from(table)
          .select('id, user_id, action, resource, created_at');
      } else if (table === 'book_clubs') {
        query = supabase
          .from(table)
          .select('id, name, description, category, status, created_at');
      } else if (table === 'events') {
        query = supabase
          .from(table)
          .select('id, title, date, location, status, created_at');
      } else if (table === 'banners') {
        query = supabase
          .from(table)
          .select('id, title, image_url, link_url, is_active, created_at');
      } else if (table === 'announcements') {
        query = supabase
          .from(table)
          .select('id, title, content, type, is_active, created_at');
      } else {
        query = supabase
          .from(table)
          .select('*');
      }

      const { data, error, status } = await query.order(orderBy, { ascending: false });

      if (error) {
        // Handle schema cache issues
        const isSchemaError = 
          error.code === 'PGRST204' || 
          error.code === 'PGRST205' || 
          error.code === 'PGRST100' || 
          error.message?.includes('column') || 
          error.message?.includes('cache') || 
          status === 404 ||
          (error as any).status === 400;

        if (isSchemaError) {
          console.warn(`Advanced columns missing for ${table}, falling back to core`);
          const { data: fallbackData, error: fallbackError } = await supabase
            .from(table)
            .select('id, created_at')
            .order(orderBy, { ascending: false });
          
          if (fallbackError) throw fallbackError;
          return fallbackData || [];
        }

        // Handle table not found
        if (status === 404 || (error as any).status === 404 || error.code === 'PGRST116' || error.message?.includes('not found')) {
          console.warn(`Table ${table} not found, returning empty list`);
          return [];
        }
        throw error;
      }

      // Normalize shipping_zones if fetched successfully
      if (table === 'shipping_zones' && data) {
        return (data as any[]).map((zone: ShippingZone) => {
          const price = (zone as any).price ?? (zone as any).rate ?? (zone as any).base_rate ?? 0;
          return {
            ...zone,
            country_code: zone.country_code || 'KE',
            estimated_days: zone.estimated_days || 3,
            shipping_method: zone.shipping_method || 'Standard',
            weight_surcharge: zone.weight_surcharge || 0,
            volume_surcharge: zone.volume_surcharge || 0,
            price
          };
        });
      }

      return data || [];
    } catch (err) {
      console.error(`Fetch failed for table ${table}:`, err);
      return [];
    }
  });
}

export async function getInventory(authorId?: string) {
  return withRetry(async () => {
    try {
      // If authorId is provided, we verify author role, otherwise admin/founder
      if (authorId) {
        await verifyRole(['author', 'admin', 'founder']);
      } else {
        await verifyAdmin();
      }

      // Explicit columns for schema resilience
      let query = supabase
        .from('products')
        .select(`
          id, title, price, sale_price, stock_quantity, image_url, category_id, author_id, status, created_at,
          category:categories(name)
        `)
        .order('created_at', { ascending: false });

      if (authorId) {
        query = query.eq('author_id', authorId);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching inventory:', error);
        
        // Handle schema cache issues
        if (error.code === 'PGRST204' || error.message?.includes('column') || error.message?.includes('cache')) {
          console.warn('[API] Inventory schema mismatch, retrying with minimal select...');
          const { data: fallback, error: fallbackError } = await supabase
            .from('products')
            .select('id, title, price, stock_quantity, image_url, author_id, created_at')
            .order('created_at', { ascending: false });
          
          if (fallbackError) throw fallbackError;
          return fallback || [];
        }
        
        throw error;
      }
      return data || [];
    } catch (err) {
      console.error('Inventory fetch failed:', err);
      return [];
    }
  });
}

export async function getOrders(partnerId?: string) {
  return withRetry(async () => {
    try {
      const session = await verifyPartner();
      
      let isAdmin = false;
      if (session) {
        const { data: profile } = await supabase.from('profiles').select('role').eq('id', session.user.id).single();
        isAdmin = profile?.role === 'founder' || profile?.role === 'admin';
      }
      
      let data;
      if (partnerId) {
        // Fetch shipping zones assigned to this partner
        const { data: zones } = await supabase
          .from('shipping_zones')
          .select('id')
          .eq('partner_id', partnerId);
        
        interface ZoneId {
          id: string;
        }
        const zoneIds = zones?.map((z: ZoneId) => z.id) || [];
        
        if (zoneIds.length === 0) return [];

        // Fetch orders for those zones with customer and item details
        // Hardened: explicit column selection to avoid schema cache issues
        const { data: orders, error } = await supabase
          .from('orders')
          .select(`
            id, created_at, status, total_amount, subtotal_amount, shipping_amount, tax_amount, is_paid, shipping_address, payment_method,
            profiles(full_name, email),
            order_items(
              id, quantity, unit_price, price_at_purchase,
              product:products(id, title, image_url)
            )
          `)
          .in('shipping_zone_id', zoneIds)
          .order('created_at', { ascending: false });
        
        if (error) {
          console.error('[API] Partner orders fetch error:', error);
          if (error.code === 'PGRST204' || error.message?.includes('column')) {
            console.warn('[API] Schema mismatch in partner orders, retrying with minimal select...');
            const { data: fallback, error: fallbackError } = await supabase
              .from('orders')
              .select(`
                id, created_at, status, total_amount, subtotal_amount, shipping_amount, tax_amount, is_paid, shipping_address,
                profiles(full_name, email),
                order_items(
                  id, order_id, product_id, quantity, unit_price, price_at_purchase,
                  product:products(id, title, image_url)
                )
              `)
              .in('shipping_zone_id', zoneIds)
              .order('created_at', { ascending: false });
            
            if (fallbackError) throw fallbackError;
            data = fallback || [];
          } else {
            throw error;
          }
        } else {
          data = orders || [];
        }
      } else {
        // ONLY admins/founders should be able to fetch all orders without a partnerId filter
        if (!isAdmin) {
          console.error('Unauthorized: Non-admin attempting to fetch all orders');
          return [];
        }
        
        // Hardened: explicit column selection to avoid schema cache issues
        const { data: orders, error } = await supabase
          .from('orders')
          .select(`
            *,
            profiles(full_name, email),
            order_items(
              *,
              product:products(id, title, image_url)
            )
          `)
          .order('created_at', { ascending: false });

        if (error) {
          console.error('[API] Admin orders fetch error:', error);
          if (error.code === 'PGRST204' || error.message?.includes('column')) {
            console.warn('[API] Schema mismatch in admin orders, retrying with minimal select...');
            const { data: fallback, error: fallbackError } = await supabase
              .from('orders')
              .select(`
                id, created_at, status, total_amount, subtotal_amount, shipping_amount, tax_amount, is_paid, shipping_address,
                profiles(full_name, email),
                order_items(
                  id, order_id, product_id, quantity, unit_price, price_at_purchase,
                  product:products(id, title, image_url)
                )
              `)
              .order('created_at', { ascending: false });
            
            if (fallbackError) throw fallbackError;
            data = fallback || [];
          } else {
            throw error;
          }
        } else {
          data = orders || [];
        }
      }

      // Map the data to include flattened customer info and formatted address
      const mappedData = data.map((order: any) => {
        const shipping = order.shipping_address || {};
        const formattedAddress = typeof shipping === 'object' 
          ? `${shipping.address || ''}, ${shipping.city || ''} (${shipping.phone || ''})`
          : shipping;

        return {
          ...order,
          customer_name: order.profiles?.full_name || shipping.full_name || 'Anonymous',
          customer_email: order.profiles?.email || shipping.email || 'N/A',
          shipping_address: formattedAddress,
          order_items: order.order_items?.map((item: any) => ({
            ...item,
            unit_price: Number(item.price_at_purchase)
          })),
          // Ensure price is numeric for the frontend
          total_amount: Number(order.total_amount),
          subtotal_amount: Number(order.subtotal_amount),
          shipping_amount: Number(order.shipping_amount),
          tax_amount: Number(order.tax_amount)
        };
      });

      if (!isAdmin && mappedData) {
        return mappedData.map((order: any) => {
          const { tax_amount, ...rest } = order;
          return rest;
        });
      }

      return mappedData;
    } catch (err) {
      console.error('Orders fetch failed:', err);
      return [];
    }
  });
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

export async function getClubs() {
  try {
    await verifyAdmin();
    const { data, error, status } = await supabase
      .from('book_clubs')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      if (status === 404 || error.code === 'PGRST116') return [];
      throw error;
    }
    return data || [];
  } catch (err) {
    console.error('Clubs fetch failed:', err);
    return [];
  }
}

export async function getEvents() {
  try {
    await verifyAdmin();
    const { data, error, status } = await supabase
      .from('events')
      .select('*')
      .order('event_date', { ascending: false });

    if (error) {
      if (status === 404 || error.code === 'PGRST116') return [];
      throw error;
    }
    return data || [];
  } catch (err) {
    console.error('Events fetch failed:', err);
    return [];
  }
}

export async function getAgreements() {
  try {
    await verifyAdmin();
    // Try fetching from 'agreements' (the main table for instances)
    const { data, error, status } = await supabase
      .from('agreements')
      .select(`*, partner:profiles(full_name, email)`)
      .order('created_at', { ascending: false });

    // Fallback if 'agreements' table is missing (using partnership_agreements templates as a last resort view)
    if (error && (status === 404 || error.code === 'PGRST116')) {
      console.warn('Agreements table missing, falling back to partnership_agreements templates');
      const { data: fallbackData, error: fallbackError } = await supabase
        .from('partnership_agreements')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (fallbackError) return [];
      return (fallbackData || []).map((p: any) => ({ ...p, partner: { full_name: 'Template', email: 'N/A' } }));
    }

    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error('Agreements fetch failed:', err);
    return [];
  }
}

/**
 * Fetch agreements for a specific user (Author or Partner)
 */
export async function getUserAgreements(userId: string) {
  try {
    const { data, error, status } = await supabase
      .from('agreements')
      .select('*')
      .eq('partner_id', userId)
      .order('created_at', { ascending: false });

    // Fallback: If 'agreements' (instances) table missing, check if user has signed any template
    // though usually agreements are the source of truth for individual users.
    if (error && (status === 404 || error.code === 'PGRST116')) {
      return [];
    }

    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error('User agreements fetch failed:', err);
    return [];
  }
}

/**
 * Submit a signed agreement
 */
export async function submitSignedAgreement(agreementId: string, signedUrl: string) {
  try {
    // 1. Update the agreement record
    // The trigger public.sync_agreement_to_application will handle 
    // updating the application status and the user role automatically.
    const { data: agreement, error: agreementError, status } = await supabase
      .from('agreements')
      .update({
        signed_url: signedUrl,
        signed_at: new Date().toISOString(),
        status: 'signed'
      })
      .eq('id', agreementId)
      .select()
      .single();

    if (agreementError) {
      if (status === 404 || agreementError.code === 'PGRST116') {
        throw new Error('Agreement record not found or table missing');
      }
      throw agreementError;
    }
    return agreement;
  } catch (err: any) {
    console.error('Submit signed agreement failed:', err);
    throw err;
  }
}

/**
 * Approve or reject an agreement (Founder only)
 */
export async function updateAgreementStatus(agreementId: string, status: 'approved' | 'rejected', notes?: string) {
  try {
    const session = await verifyAdmin();
    const { data, error, status: httpStatus } = await supabase
      .from('agreements')
      .update({
        status,
        approved_at: status === 'approved' ? new Date().toISOString() : null,
        approved_by: session?.user?.id,
        description: notes // Using description as internal notes for rejection if needed
      })
      .eq('id', agreementId)
      .select()
      .single();

    if (error) {
      if (httpStatus === 404 || error.code === 'PGRST116') {
        throw new Error('Agreement record not found or table missing');
      }
      throw error;
    }

    // If approved, ensure the user has the correct role privileges or status
    if (status === 'approved' && data.partner_id) {
      // We might want to update the profile or send a notification
      await supabase.from('profiles').update({
        role: data.type === 'author' ? 'author' : 'partner'
      }).eq('id', data.partner_id);
    }

    return data;
  } catch (err: any) {
    console.error('Update agreement status failed:', err);
    throw err;
  }
}

export async function getBanners() {
  try {
    await verifyAdmin();
    const { data, error } = await supabase
      .from('banners')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }
    return data || [];
  } catch (err) {
    console.error('Banners fetch failed:', err);
    return [];
  }
}

export async function getAnnouncements() {
  try {
    await verifyAdmin();
    const { data, error } = await supabase
      .from('announcements')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }
    return data || [];
  } catch (err) {
    console.error('Announcements fetch failed:', err);
    return [];
  }
}

/**
 * CMS content compatibility - now split into banners and announcements
 */
export async function getCMSContent(forcePublic: boolean = false) {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    
    // Check if session exists and user is admin/founder
    let isAdmin = false;
    if (session) {
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', session.user.id).single();
      isAdmin = profile?.role === 'founder' || profile?.role === 'admin';
    }

    if (!forcePublic && !isAdmin) {
      return [];
    }

    // CMS content is now split into multiple tables
    const [banners, announcements] = await Promise.all([
      supabase.from('banners').select('*').eq('is_active', true),
      supabase.from('announcements').select('*').eq('is_active', true)
    ]);

    // Format them back to the legacy structure for compatibility
    const formattedBanners = (banners.data || []).map((b: any) => ({ ...b, type: 'banner' }));
    const formattedAnnouncements = (announcements.data || []).map((a: any) => ({ ...a, type: 'announcement' }));

    return [...formattedBanners, ...formattedAnnouncements];
  } catch (err) {
    console.error('CMS Content fetch failed:', err);
    return [];
  }
}

export async function getPromos() {
  return withRetry(async () => {
    try {
      await verifyAdmin();
      // Fetch from promos table using select('*') to avoid 400 errors if specific columns are missing
      // This is more robust against schema mismatches (e.g. missing discount_type)
      const { data, error } = await supabase
        .from('promos')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // Normalize data for UI with safe defaults
      const normalizedData = (data || []).map((p: any) => ({
        ...p,
        title: p.code,
        status: p.status || (p.is_active ? 'active' : 'inactive'),
        type: p.discount_type || 'percentage',
        value: p.discount_value || 0,
        end_date: p.expires_at,
        start_date: (p as any).start_at
      }));

      return normalizedData;
    } catch (err) {
      console.error('Promos fetch failed:', err);
      return [];
    }
  });
}

/**
 * Enhanced Promotion Campaign Services
 */

export async function initializeCampaign(campaign: any) {
  await verifyAdmin();
  const { data: { session } } = await supabase.auth.getSession();
  
  const campaignData = {
    ...campaign,
    creator_id: session?.user?.id,
    promo_signature: campaign.promo_signature || `SIG-${Math.random().toString(36).substring(2, 9).toUpperCase()}`,
    status: 'draft'
  };

  // If the database has 'type' but we're sending 'discount_type',
  // and it's NOT NULL, we should copy the value.
  if (campaignData.discount_type && !campaignData.type) {
    campaignData.type = campaignData.discount_type;
  }
  if (campaignData.discount_value !== undefined && campaignData.value === undefined) {
    campaignData.value = campaignData.discount_value;
  }

  return createRecord('promos', campaignData);
}

export async function updateCampaignStatus(promoId: string, status: string, notes?: string) {
  const session = await verifyAdmin();
  
  const updates: any = { status };
  if (status === 'active') {
    updates.approved_at = new Date().toISOString();
    updates.approver_id = session?.user?.id;
  }

  const result = await updateRecord('promos', promoId, updates);
  
  if (result) {
    await supabase.from('promo_audit_logs').insert([{
      promo_id: promoId,
      actor_id: session?.user?.id,
      action: status === 'active' ? 'approve' : 'update_status',
      new_state: { status, notes }
    }]);
  }
  
  return result;
}

export async function getPromoMetrics(promoId: string) {
  try {
    await verifyAdmin();
    // Use select('*') for schema resilience
    const { data, error } = await supabase
      .from('promo_metrics')
      .select('*')
      .eq('promo_id', promoId)
      .order('recorded_at', { ascending: false });

    if (error) {
      throw error;
    }
    return data || [];
  } catch (err) {
    console.error('Promo Metrics fetch failed:', err);
    return [];
  }
}

export async function getPromoAuditLogs(promoId: string) {
  try {
    await verifyAdmin();
    // Use select('*') for schema resilience but include relation
    const { data, error } = await supabase
      .from('promo_audit_logs')
      .select(`*, actor:profiles(full_name)`)
      .eq('promo_id', promoId)
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }
    return data || [];
  } catch (err) {
    console.error('Promo Audit Logs fetch failed:', err);
    return [];
  }
}

export async function calculateImpact(promoId: string) {
  try {
    await verifyAdmin();
    // This would involve complex logic to calculate actual vs predicted impact
    // For now, we'll fetch current utilization and order data
    const { data: promo, error } = await supabase
      .from('promos')
      .select('*')
      .eq('id', promoId)
      .maybeSingle();
    
    if (error) throw error;
    
    // Logic to simulate impact calculation
    const impact = (promo?.utilization_count || 0) * Number(promo?.discount_value || 0);
    
    await updateRecord('promos', promoId, { impact_value: impact });
    return impact;
  } catch (err) {
    console.error('Calculate Impact failed:', err);
    return 0;
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
    await verifyRole(['author', 'admin', 'founder']);
    
    return withRetry(async () => {
      // Hardened query to avoid schema cache issues and fix alias-related 400 errors
      const { data, error } = await supabase
        .from('order_items')
        .select(`
          *,
          orders!inner(*),
          products!inner(*)
        `)
        .eq('products.author_id', authorId)
        .eq('orders.is_paid', true);
      
      if (error) {
        console.error('[API] Author Sales Report fetch error:', error);
        
        // Handle specific schema cache errors (PGRST204/PGRST205) or 400 Bad Request
        if (error.code === 'PGRST204' || error.message?.includes('column') || (error as any).status === 400) {
           console.warn('[API] Schema mismatch in order_items, retrying with minimal select...');
           const { data: fallback, error: fallbackError } = await supabase
            .from('order_items')
            .select(`
              id,
              order_id,
              product_id,
              quantity,
              unit_price,
              price_at_purchase,
              created_at
            `)
            .order('created_at', { ascending: false });
            
            if (fallbackError) throw fallbackError;
            
            if (!fallback || fallback.length === 0) return [];

            // Manually filter by product author_id
            const productIds = [...new Set(fallback.map((item: any) => item.product_id).filter(Boolean))];
            if (productIds.length > 0) {
              const { data: productData } = await supabase
                .from('products')
                .select('id, title, author_id')
                .in('id', productIds)
                .eq('author_id', authorId);
              
              if (!productData || productData.length === 0) return [];

              const authorProductIds = new Set(productData.map(p => p.id));
              const authorItems = fallback.filter(item => authorProductIds.has(item.product_id));

              // Manually fetch and filter by paid orders
              const orderIds = [...new Set(authorItems.map(item => item.order_id).filter(Boolean))];
              if (orderIds.length > 0) {
                const { data: orderData } = await supabase
                  .from('orders')
                  .select('id, created_at, is_paid')
                  .in('id', orderIds)
                  .eq('is_paid', true);
                
                if (!orderData || orderData.length === 0) return [];

                const paidOrderIds = new Set(orderData.map(o => o.id));
                const productsMap = productData.reduce((acc: any, p: any) => {
                  acc[p.id] = p;
                  return acc;
                }, {});
                const ordersMap = orderData.reduce((acc: any, o: any) => {
                  acc[o.id] = o;
                  return acc;
                }, {});

                return authorItems
                  .filter(item => paidOrderIds.has(item.order_id))
                  .map(item => ({
                    ...item,
                    orders: ordersMap[item.order_id],
                    products: productsMap[item.product_id]
                  }));
              }
            }
            return [];
        }
        throw error;
      }
      return data || [];
    });
  } catch (err) {
    console.error('Author Sales Report fetch failed:', err);
    return [];
  }
}

export async function getPartnerPayouts(partnerId: string) {
  return withRetry(async () => {
    try {
      await verifyRole(['partner', 'author', 'admin', 'founder']);
      
      // First Principles: Fetch ledger entries directly to avoid relationship errors
      const { data: ledgerData, error: ledgerError } = await supabase
        .from('fulfillment_ledger')
        .select(`*`)
        .eq('partner_id', partnerId)
        .order('created_at', { ascending: false });
      
      if (ledgerError) {
        if (ledgerError.code === '42703') {
          // If payout_status is missing, fetch without it
          const { data: fallbackData, error: fallbackError } = await supabase
            .from('fulfillment_ledger')
            .select('id, amount, created_at, metadata, order_id, partner_id')
            .eq('partner_id', partnerId)
            .order('created_at', { ascending: false });
          if (fallbackError) throw fallbackError;
          return (fallbackData || []).map(item => ({ ...item, payout_status: 'pending' }));
        }
        throw ledgerError;
      }
      if (!ledgerData || ledgerData.length === 0) return [];

      // Manually fetch related orders
      const orderIds = [...new Set(ledgerData.map((item: any) => item.order_id).filter(Boolean))];
      
      if (orderIds.length > 0) {
        const { data: orderData, error: orderError } = await supabase
          .from('orders')
          .select('id, status, total_amount, created_at, is_paid')
          .in('id', orderIds);
        
        if (!orderError && orderData) {
          const ordersMap = orderData.reduce((acc: any, o: any) => {
            acc[o.id] = o;
            return acc;
          }, {});

          return ledgerData.map((item: any) => ({
            ...item,
            order: item.order_id ? ordersMap[item.order_id] : null
          }));
        }
      }

      return ledgerData;
    } catch (err) {
      console.error('Partner Payouts fetch failed:', err);
      return [];
    }
  });
}

export async function getAuthorPayouts(authorId: string) {
  return getPartnerPayouts(authorId);
}

/**
 * Fetch payment methods for a user (Author/Partner)
 */
export async function getPaymentMethods(userId: string) {
  try {
    const { data, error } = await supabase
      .from('payment_methods')
      .select('*')
      .eq('user_id', userId);

    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error('Payment Methods fetch failed:', err);
    return [];
  }
}

export async function addPaymentMethod(method: any) {
  try {
    const session = await verifyRole(['author', 'partner', 'admin', 'founder']);
    
    // Ensure identifier is set for M-Pesa (required for K2 disbursement)
    const processedMethod = { ...method };
    if (processedMethod.type === 'mpesa' && !processedMethod.identifier && processedMethod.details?.phone) {
      processedMethod.identifier = processedMethod.details.phone;
    }

    const { data, error } = await supabase
      .from('payment_methods')
      .insert([{ ...processedMethod, user_id: processedMethod.user_id || session.user.id }])
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (err) {
    console.error('Add Payment Method failed:', err);
    throw err;
  }
}

export async function deletePaymentMethod(methodId: string) {
  try {
    const session = await verifyRole(['author', 'partner', 'admin', 'founder']);
    const { error } = await supabase
      .from('payment_methods')
      .delete()
      .eq('id', methodId)
      .eq('user_id', session.user.id);

    if (error) throw error;
    return true;
  } catch (err) {
    console.error('Delete Payment Method failed:', err);
    throw err;
  }
}

export async function setDefaultPaymentMethod(methodId: string) {
  try {
    const session = await verifyRole(['author', 'partner', 'admin', 'founder']);
    
    // Reset all to false first
    await supabase
      .from('payment_methods')
      .update({ is_default: false })
      .eq('user_id', session.user.id);

    // Set new default
    const { data, error } = await supabase
      .from('payment_methods')
      .update({ is_default: true })
      .eq('id', methodId)
      .eq('user_id', session.user.id)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (err) {
    console.error('Set Default Payment Method failed:', err);
    throw err;
  }
}

export async function getAuthorReviews(authorId: string) {
  try {
    await verifyRole(['author', 'admin', 'founder']);
    
    // Hardened query to avoid relationship/schema cache errors
    const { data, error } = await supabase
      .from('reviews')
      .select(`
        *,
        product:products(*)
      `)
      .eq('product.author_id', authorId)
      .order('created_at', { ascending: false });

    if (error) {
      // Handle relationship errors (PGRST200) or 400 Bad Request
      if (error.code === 'PGRST200' || error.message?.includes('relationship') || error.message?.includes('cache') || (error as any).status === 400) {
        console.warn('[API] Schema mismatch in author reviews, retrying with manual join...');
        
        // 1. Fetch reviews first
        const { data: reviews, error: reviewsError } = await supabase
          .from('reviews')
          .select('*')
          .order('created_at', { ascending: false });
        
        if (reviewsError) throw reviewsError;
        if (!reviews || reviews.length === 0) return [];

        // 2. Fetch products for this author
        const { data: products, error: productsError } = await supabase
          .from('products')
          .select('id, title, image_url, author_id')
          .eq('author_id', authorId);
        
        if (productsError) throw productsError;
        
        const authorProductIds = new Set((products || []).map(p => p.id));
        const authorReviews = reviews.filter(r => authorProductIds.has(r.product_id));
        
        if (authorReviews.length === 0) return [];

        // 3. Fetch profiles for reviewers
        const profileIds = [...new Set(authorReviews.map(r => r.user_id).filter(Boolean))];
        const { data: profiles } = profileIds.length > 0 
          ? await supabase.from('profiles').select('id, full_name, avatar_url').in('id', profileIds)
          : { data: [] };

        const productsMap = (products || []).reduce((acc: any, p: any) => {
          acc[p.id] = p;
          return acc;
        }, {});

        const profilesMap = (profiles || []).reduce((acc: any, p: any) => {
          acc[p.id] = p;
          return acc;
        }, {});

        return authorReviews.map(r => ({
          ...r,
          product: productsMap[r.product_id],
          profile: profilesMap[r.user_id]
        }));
      }
      throw error;
    }

    // Still need to fetch profiles if they weren't in the initial successful query
    // (Wait, the initial query HAD profiles(*) - let's keep it if it works)
    return data || [];
  } catch (err) {
    console.error('Author Reviews fetch failed:', err);
    return [];
  }
}

/**
 * --- Author First-Class Domain Services ---
 */

export async function getAuthorProfile(authorId: string) {
  try {
    const { data, error } = await supabase
      .from('authors')
      .select('*')
      .eq('id', authorId)
      .maybeSingle();

    if (error) throw error;
    return data;
  } catch (err) {
    console.error('Author Profile fetch failed:', err);
    return null;
  }
}

export async function updateAuthorProfile(authorId: string, profileData: any) {
  try {
    const session = await verifyRole(['author', 'admin', 'founder']);
    if (session.user.id !== authorId && !['admin', 'founder'].includes((session.user as any).role)) {
      throw new Error('Unauthorized');
    }

    const { data, error } = await supabase
      .from('authors')
      .update(profileData)
      .eq('id', authorId)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (err) {
    console.error('Author Profile update failed:', err);
    throw err;
  }
}

export async function getAuthorEarnings(authorId: string) {
  try {
    await verifyRole(['author', 'admin', 'founder']);
    
    // Hardened query to handle potential schema cache/relationship errors
    const { data, error } = await supabase
      .from('author_earnings')
      .select('*')
      .eq('author_id', authorId)
      .maybeSingle();

    if (error) {
      if (error.code === 'PGRST204' || error.message?.includes('cache') || (error as any).status === 400) {
        console.warn('[API] Schema mismatch in author earnings, retrying with minimal select...');
        const { data: fallback, error: fallbackError } = await supabase
          .from('author_earnings')
          .select('id, author_id, total_earnings, current_balance, created_at')
          .eq('author_id', authorId)
          .maybeSingle();
        
        if (fallbackError) throw fallbackError;
        return fallback;
      }
      throw error;
    }
    return data;
  } catch (err) {
    console.error('Author Earnings fetch failed:', err);
    return null;
  }
}

export async function getAuthorDrops(authorId: string) {
  try {
    const { data, error } = await supabase
      .from('author_drops')
      .select('*')
      .eq('author_id', authorId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error('Author Drops fetch failed:', err);
    return [];
  }
}

export async function createAuthorDrop(dropData: any) {
  try {
    const session = await verifyRole(['author', 'admin', 'founder']);
    const { data, error } = await supabase
      .from('author_drops')
      .insert([{ ...dropData, author_id: session.user.id }])
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (err) {
    console.error('Create Author Drop failed:', err);
    throw err;
  }
}

export async function requestAuthorPayout(authorId: string, amount: number, details: any) {
  try {
    const session = await verifyRole(['author', 'admin', 'founder']);
    if (session.user.id !== authorId) throw new Error('Unauthorized');

    // Call the Supabase Edge Function instead of direct database insert
    const { data: { session: authSession } } = await supabase.auth.getSession();
    if (!authSession) throw new Error('No active session');

    const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/payments/author-payout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authSession.access_token}`,
        'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY
      },
      body: JSON.stringify({
        amount,
        phone: details.identifier || details.phone || details.phone_number
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to request payout');
    }

    return await response.json();
  } catch (err) {
    console.error('Payout Request failed:', err);
    throw err;
  }
}

/**
 * --- Fan Subscriptions & Memberships ---
 */

export async function getAuthorSubscriptions(authorId: string) {
  try {
    await verifyRole(['author', 'admin', 'founder']);
    
    // Hardened query to avoid relationship/schema cache errors
    const { data, error } = await supabase
      .from('author_subscriptions')
      .select(`
        *,
        subscriber:profiles(id, full_name, avatar_url, email)
      `)
      .eq('author_id', authorId)
      .order('created_at', { ascending: false });

    if (error) {
      // Handle relationship errors (PGRST200) or 400 Bad Request
      if (error.code === 'PGRST200' || error.message?.includes('relationship') || error.message?.includes('cache') || (error as any).status === 400) {
        console.warn('[API] Schema mismatch in author subscriptions, retrying with manual join...');
        
        const { data: subs, error: subsError } = await supabase
          .from('author_subscriptions')
          .select('*')
          .eq('author_id', authorId)
          .order('created_at', { ascending: false });
        
        if (subsError) throw subsError;
        if (!subs || subs.length === 0) return [];

        const subscriberIds = [...new Set(subs.map(s => s.subscriber_id).filter(Boolean))];
        const { data: profiles } = subscriberIds.length > 0
          ? await supabase.from('profiles').select('id, full_name, avatar_url, email').in('id', subscriberIds)
          : { data: [] };

        const profilesMap = (profiles || []).reduce((acc: any, p: any) => {
          acc[p.id] = p;
          return acc;
        }, {});

        return subs.map(s => ({
          ...s,
          subscriber: profilesMap[s.subscriber_id]
        }));
      }
      throw error;
    }
    return data || [];
  } catch (err) {
    console.error('Author Subscriptions fetch failed:', err);
    return [];
  }
}

export async function getMyAuthorSubscriptions(subscriberId: string) {
  try {
    // Hardened query to avoid relationship/schema cache errors
    const { data, error } = await supabase
      .from('author_subscriptions')
      .select(`
        *,
        author:authors(id, display_name, pen_name)
      `)
      .eq('subscriber_id', subscriberId)
      .order('created_at', { ascending: false });

    if (error) {
      // Handle relationship errors (PGRST200) or 400 Bad Request
      if (error.code === 'PGRST200' || error.message?.includes('relationship') || error.message?.includes('cache') || (error as any).status === 400) {
        console.warn('[API] Schema mismatch in my subscriptions, retrying with manual join...');
        
        const { data: subs, error: subsError } = await supabase
          .from('author_subscriptions')
          .select('*')
          .eq('subscriber_id', subscriberId)
          .order('created_at', { ascending: false });
        
        if (subsError) throw subsError;
        if (!subs || subs.length === 0) return [];

        const authorIds = [...new Set(subs.map(s => s.author_id).filter(Boolean))];
        const { data: authors } = authorIds.length > 0
          ? await supabase.from('authors').select('id, display_name, pen_name').in('id', authorIds)
          : { data: [] };

        const authorsMap = (authors || []).reduce((acc: any, a: any) => {
          acc[a.id] = a;
          return acc;
        }, {});

        return subs.map(s => ({
          ...s,
          author: authorsMap[s.author_id]
        }));
      }
      throw error;
    }
    return data || [];
  } catch (err) {
    console.error('My Author Subscriptions fetch failed:', err);
    return [];
  }
}

export async function updateAuthorSubscription(id: string, updates: any) {
  try {
    await verifyAdmin();
    const { data, error } = await supabase
      .from('author_subscriptions')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (err) {
    console.error('Update Author Subscription failed:', err);
    throw err;
  }
}

export async function getPartnershipServices() {
  try {
    const { data, error } = await supabase
      .from('partnership_services')
      .select('*')
      .eq('is_active', true);

    if (error) {
      if (error.message?.includes('display_order') || error.message?.includes('column')) {
        console.warn('display_order column missing in partnership_services, retrying without order');
        const { data: fallback, error: fallbackError } = await supabase
          .from('partnership_services')
          .select('*')
          .eq('is_active', true);
        if (fallbackError) throw fallbackError;
        return fallback || [];
      }
      throw error;
    }

    // Sort manually if display_order exists in the returned data
    const sortedData = [...(data || [])];
    if (sortedData.length > 0 && 'display_order' in sortedData[0]) {
      sortedData.sort((a, b) => (a.display_order || 0) - (b.display_order || 0));
    }

    return sortedData;
  } catch (err) {
    console.error('Partnership Services fetch failed:', err);
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

/**
 * Protocol Agreements (Templates) Management
 */
export async function getProtocolAgreements() {
  try {
    await verifyAdmin();
    // Use select('*') for schema resilience
    const { data, error, status } = await supabase
      .from('partnership_agreements')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      if (status === 404 || error.code === 'PGRST116') return [];
      throw error;
    }
    
    // Normalize for UI if needed (renaming title to name)
    const normalizedData = (data || []).map((p: any) => ({
      ...p,
      name: p.title
    }));
    
    return normalizedData;
  } catch (err) {
    console.error('Protocol Agreements fetch failed:', err);
    return [];
  }
}

/**
 * Fetch all payouts for admin review
 */
export async function getAllPayouts() {
  return withRetry(async () => {
    try {
      await verifyAdmin();
      
      // First Principles: Fetch ledger entries directly to avoid relationship errors
      const { data: ledgerData, error: ledgerError } = await supabase
        .from('fulfillment_ledger')
        .select(`*`)
        .order('created_at', { ascending: false });
        
      if (ledgerError) {
        // Fallback: If order_id or other columns really don't exist yet, fetch what's available
        if (ledgerError.code === '42703' || ledgerError.message?.includes('column')) {
           const { data: fallbackData, error: fallbackError } = await supabase
             .from('fulfillment_ledger')
             .select('id, amount, created_at, metadata, order_id, partner_id')
             .order('created_at', { ascending: false });
           if (fallbackError) throw fallbackError;
           return (fallbackData || []).map(item => ({ ...item, payout_status: 'pending' }));
        }
        throw ledgerError;
      }
      if (!ledgerData || ledgerData.length === 0) return [];

      // Fetch related data manually
      const orderIds = [...new Set(ledgerData.map((item: any) => item.order_id).filter(Boolean))];
      const partnerIds = [...new Set(ledgerData.map((item: any) => item.partner_id).filter(Boolean))];

      const [ordersResponse, partnersResponse] = await Promise.all([
        orderIds.length > 0 ? supabase.from('orders').select('id, status, total_amount, created_at, is_paid').in('id', orderIds) : Promise.resolve({ data: [] }),
        partnerIds.length > 0 ? supabase.from('profiles').select('id, full_name, email, role, avatar_url').in('id', partnerIds) : Promise.resolve({ data: [] })
      ]);

      const ordersMap = (ordersResponse.data || []).reduce((acc: any, o: any) => {
        acc[o.id] = o;
        return acc;
      }, {});

      const partnersMap = (partnersResponse.data || []).reduce((acc: any, p: any) => {
        acc[p.id] = p;
        return acc;
      }, {});
      
      return ledgerData.map((item: any) => ({
        ...item,
        order: item.order_id ? ordersMap[item.order_id] : null,
        partner: item.partner_id ? partnersMap[item.partner_id] : null
      }));
    } catch (err) {
      console.error('All Payouts fetch failed:', err);
      return [];
    }
  });
}

/**
 * Trigger disbursement process
 */
export async function disbursePayouts() {
  try {
    await verifyAdmin();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('No session');

    const response = await fetch('/api/payments?action=disburse', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
        'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY
      }
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.message || 'Disbursement failed');
    }

    return await response.json();
  } catch (err) {
    console.error('Disbursement trigger failed:', err);
    throw err;
  }
}

export async function createProtocolAgreement(protocol: any) {
  await verifyAdmin();
  const { data, error } = await supabase
    .from('partnership_agreements')
    .insert([protocol])
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateProtocolAgreement(id: string, updates: any) {
  await verifyAdmin();
  const { data, error } = await supabase
    .from('partnership_agreements')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteProtocolAgreement(id: string) {
  await verifyAdmin();
  const { error } = await supabase
    .from('partnership_agreements')
    .delete()
    .eq('id', id);

  if (error) throw error;
  return true;
}

/**
 * Fetch notification logs for Communications tab
 */
export async function getNotificationLogs() {
  try {
    await verifyAdmin();
    const { data, error } = await supabase
      .from('notification_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);
    
    if (error) throw error;
    return data;
  } catch (error: any) {
    console.error('Failed to fetch notification logs:', error);
    throw error;
  }
}

/**
 * Send a custom email via the Communications API
 */
export async function sendCustomEmail(payload: {
  to: string | string[];
  subject: string;
  message: string;
  previewText?: string;
  useTemplate?: boolean;
}) {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) throw new Error('Not authenticated');

    const response = await fetch('/api/communications?action=send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
        'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY
      },
      body: JSON.stringify(payload)
    });

    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Failed to send email');
    return result;
  } catch (error: any) {
    console.error('Email sending failed:', error);
    throw error;
  }
}

export async function updateApplicationStatus(table: string, id: string, status: string, userId?: string) {
  await verifyAdmin();
  
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('No active session');

  const type = table === 'author_applications' ? 'author' : 'partner';
  
  const response = await fetch('/api/applications', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`,
      'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY
    },
    body: JSON.stringify({
      id,
      type,
      status,
      userId
    })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to update application status');
  }

  return await response.json();
}

export async function getApprovedAuthors() {
  try {
    // Check if we have a session. If we do, we can attempt to verify admin.
    // If we don't, or if verification fails, we can still return a public list
    // of authors if RLS allows it.
    const { data: { session } } = await supabase.auth.getSession();
    
    // For the Founder Dashboard, we want to select email. 
    // For public views, we should probably exclude email.
    // Let's check if the user is an admin.
    let isAdmin = false;
    if (session) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', session.user.id)
        .single();
      isAdmin = profile?.role === 'founder' || profile?.role === 'admin';
    }

    let query = supabase
      .from('profiles')
      .select(isAdmin ? 'id, full_name, email' : 'id, full_name')
      .eq('role', 'author')
      .order('full_name');

    let { data, error } = await query;
    
    // Fallback if any 400 error (likely role filter or column issue)
    if (error) {
      console.warn('Profiles role filter failed, retrying without filter.');
      const { data: allData, error: allErr } = await supabase
        .from('profiles')
        .select(isAdmin ? 'id, full_name, email, role' : 'id, full_name, role')
        .order('full_name');
      
      if (!allErr && allData) {
        data = allData.filter((p: any) => p.role === 'author');
        error = null;
      }
    }

    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error('Approved Authors fetch failed:', err);
    return [];
  }
}

export async function getCategories() {
  try {
    // Categories are public for shop filtering
    return await getAllRecords('categories', 'name');
  } catch (err) {
    console.error('Categories fetch failed:', err);
    return [];
  }
}

export async function getSiteSettings() {
  try {
    await verifyAdmin();
    // Fetch basic settings first - no joins to avoid 400 errors if schema is out of sync
    // Use select('*') for schema resilience
    let { data: siteData, error: siteError } = await supabase
      .from('site_settings')
      .select('*')
      .maybeSingle();

    if (siteError) {
      if (siteError.code === 'PGRST204' || siteError.code === 'PGRST100' || siteError.message?.includes('column') || siteError.message?.includes('cache') || (siteError as any).status === 400) {
        console.warn('Advanced site settings columns missing, falling back to core');
        const { data: fallbackData, error: fallbackError } = await supabase
          .from('site_settings')
          .select('id, site_name, contact_email')
          .maybeSingle();
        if (fallbackError) {
          console.error('Site Settings fallback also failed:', fallbackError);
          return {};
        }
        siteData = fallbackData as any;
      } else {
        throw siteError;
      }
    }
    if (!siteData) return {};

    // Sanitize dummy numbers and provide defaults for missing columns
    const sanitizedData: any = { 
      tax_rate: 16.00,
      default_currency: 'KES',
      ...siteData 
    };
    const dummyPattern = /700 000 000|700000000/;
    
    if (sanitizedData.contact_phone && dummyPattern.test(sanitizedData.contact_phone)) {
      sanitizedData.contact_phone = '+254 794 129 958';
    }
    if (sanitizedData.secondary_phone && dummyPattern.test(sanitizedData.secondary_phone)) {
      sanitizedData.secondary_phone = '+254 741 658 548';
    }
    if (sanitizedData.whatsapp_link && dummyPattern.test(sanitizedData.whatsapp_link)) {
      sanitizedData.whatsapp_link = 'https://wa.me/254794129958';
    }

    // Fetch Author of the Day profile separately if enabled
    if (sanitizedData.author_of_the_day_id) {
      const { data: profileData } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url')
        .eq('id', sanitizedData.author_of_the_day_id)
        .maybeSingle();
      
      if (profileData) {
        sanitizedData.author_of_the_day = profileData;
      }
    }

    // Fetch featured books if present
    if (sanitizedData.author_of_the_day_books && sanitizedData.author_of_the_day_books.length > 0) {
      const { data: bookData } = await supabase
        .from('products')
        .select('id, title, image_url, price, author_id')
        .in('id', sanitizedData.author_of_the_day_books);
      
      if (bookData) {
        sanitizedData.featured_books = bookData;
      }
    }

    return sanitizedData;
  } catch (err) {
    console.error('Site Settings fetch failed:', err);
    return {};
  }
}

/**
 * Generic Create with Retry and Audit
 */
export async function createRecord(table: string, record: any) {
  await verifyAdmin();
  
  const currentRecord = { ...record };
  
  return withRetry(async () => {
    try {
      // Use explicit select('id') to avoid schema cache issues with select(*)
      const { data, error, status } = await supabase
        .from(table)
        .insert([currentRecord])
        .select('id')
        .maybeSingle();

      if (error) {
        // Handle table not found
        if (status === 404 || error.code === 'PGRST116' || error.message?.includes('not found')) {
          console.warn(`Table ${table} not found during create`);
          throw new Error(`Table ${table} does not exist`);
        }

        // Handle missing columns (PGRST204) or schema cache errors
        if (error.code === 'PGRST204' || 
            (error.message?.includes('column') && 
             (error.message?.includes('not found') || error.message?.includes('cache')))) {
          
          const match = error.message.match(/['"]([^'"]+)['"] column/) || 
                        error.message.match(/column ['"]([^'"]+)['"]/) ||
                        error.message.match(/column ([^ ]+) does not exist/);
          
          if (match && match[1]) {
            const missingCol = match[1];
            
            if (missingCol !== table) {
              console.warn(`Column ${missingCol} missing in ${table}, filtering and retrying...`);
              delete currentRecord[missingCol];
              throw error; 
            }
          }
        }

        // Handle NOT NULL violations (23502) - Don't delete, just log and fail
        if (error.code === '23502' || error.message?.includes('violates not-null')) {
          console.error(`NOT NULL violation in ${table}:`, error.message);
          throw error; // Don't retry by deleting the column
        }
        throw error;
      }
      
      if (data) {
        await logAudit('CREATE', table, data.id, currentRecord);
      }
      
      return data;
    } catch (err) {
      throw err;
    }
  }, {
    retries: 10,
    onRetry: (error: any, attempt: number) => {
      console.warn(`Retry attempt ${attempt} for createRecord on ${table}:`, error.message);
    }
  });
}

/**
 * Generic Update with Retry and Audit
 */
export async function updateRecord(table: string, id: string, updates: any) {
  await verifyAdmin();
  
  const currentUpdates = { ...updates };
  
  return withRetry(async () => {
    try {
      // Fetch old data for audit before update
      // Hardened: only select ID first to avoid schema cache issues on select(*)
      let oldData = null;
      try {
        const { data } = await supabase.from(table).select('id').eq('id', id).maybeSingle();
        if (data) {
          // Then try to get the rest with explicit columns for common tables
          let fullDataQuery;
          if (table === 'products') {
            fullDataQuery = supabase.from(table).select('*').eq('id', id).maybeSingle();
          } else if (table === 'profiles') {
            fullDataQuery = supabase.from(table).select('*').eq('id', id).maybeSingle();
          } else if (table === 'orders') {
            fullDataQuery = supabase.from(table).select('*').eq('id', id).maybeSingle();
          } else if (table === 'site_settings') {
            fullDataQuery = supabase.from(table).select('*').eq('id', id).maybeSingle();
          } else {
            // For unknown tables, we use a very minimal set
            fullDataQuery = supabase.from(table).select('*').eq('id', id).maybeSingle();
          }
          
          const { data: fullData } = await fullDataQuery;
          oldData = fullData || data;
        }
      } catch (e) {
        console.warn('Failed to fetch full oldData for audit, proceeding with minimal data');
      }

      // Use explicit select('id') to avoid schema cache issues with select(*)
      const { data, error, status } = await supabase
        .from(table)
        .update(currentUpdates)
        .eq('id', id)
        .select('id')
        .maybeSingle();

      if (error) {
        // Handle table not found
        if (status === 404 || error.code === 'PGRST116' || error.message?.includes('not found')) {
          console.warn(`Table ${table} not found during update`);
          throw new Error(`Table ${table} does not exist`);
        }

        // Handle missing columns (PGRST204) or schema cache errors
        if (error.code === 'PGRST204' || 
            (error.message?.includes('column') && 
             (error.message?.includes('not found') || error.message?.includes('cache')))) {
          
          const match = error.message.match(/['"]([^'"]+)['"] column/) || 
                        error.message.match(/column ['"]([^'"]+)['"]/) ||
                        error.message.match(/column ([^ ]+) does not exist/);
          
          if (match && match[1]) {
            let missingCol = match[1];
            
            if (missingCol === table) {
              const allMatches = error.message.matchAll(/['"]([^'"]+)['"]/g);
              for (const m of allMatches) {
                if (m[1] !== table) {
                  missingCol = m[1];
                  break;
                }
              }
            }
            
            if (missingCol !== table) {
              console.warn(`Column ${missingCol} missing in ${table}, filtering and retrying...`);
              delete currentUpdates[missingCol];
              throw error;
            }
          }
        }
        throw error;
      }
      
      await logAudit('UPDATE', table, id, currentUpdates, oldData);
      return data;
    } catch (err) {
      throw err;
    }
  }, {
    retries: 10,
    onRetry: (error: any, attempt: number) => {
      console.warn(`Retry attempt ${attempt} for updateRecord on ${table}:`, error.message);
    }
  });
}

/**
 * Generic Delete with Retry and Audit
 */
export async function deleteRecord(table: string, id: string) {
  await verifyAdmin();
  
  return withRetry(async () => {
    // Optionally fetch old data for audit
    // Hardened: handle potential schema cache issues when fetching oldData
    let oldData = null;
    try {
      const { data } = await supabase.from(table).select('id').eq('id', id).maybeSingle();
      if (data) {
        // Then try to get the rest with explicit columns for common tables
        let fullDataQuery;
        if (table === 'products') {
          fullDataQuery = supabase.from(table).select('*').eq('id', id).maybeSingle();
        } else if (table === 'profiles') {
          fullDataQuery = supabase.from(table).select('*').eq('id', id).maybeSingle();
        } else if (table === 'orders') {
          fullDataQuery = supabase.from(table).select('*').eq('id', id).maybeSingle();
        } else if (table === 'site_settings') {
          fullDataQuery = supabase.from(table).select('*').eq('id', id).maybeSingle();
        } else {
          // For unknown tables, we use a very minimal set
          fullDataQuery = supabase.from(table).select('*').eq('id', id).maybeSingle();
        }
        
        const { data: fullData } = await fullDataQuery;
        oldData = fullData || data;
      }
    } catch (e) {
      console.warn(`Failed to fetch oldData for deletion audit on ${table}, proceeding...`);
    }

    const { error } = await supabase
      .from(table)
      .delete()
      .eq('id', id);

    if (error) throw error;
    
    // Log the action
    await logAudit('DELETE', table, id, null, oldData);
    
    return true;
  }, {
    onRetry: (error: any, attempt: number) => {
      console.warn(`Retry attempt ${attempt} for deleteRecord on ${table}:`, error);
    }
  });
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

// --- New Table CRUD Functions (Post-Polymorphic Split) ---

export async function createBookClub(club: any) {
  await verifyAdmin();
  const { data, error } = await supabase
    .from('book_clubs')
    .insert([club])
    .select()
    .headers({ 'X-PostgREST-Schema-Cache-Reload': 'true' })
    .single();

  if (error) throw error;
  if (data) await logAudit('CREATE', 'book_clubs', data.id, club);
  return data;
}

export async function updateBookClub(id: string, updates: any) {
  await verifyAdmin();
  const { data, error } = await supabase
    .from('book_clubs')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  if (data) await logAudit('UPDATE', 'book_clubs', id, updates);
  return data;
}

export async function createEvent(event: any) {
  await verifyAdmin();
  const { data, error } = await supabase
    .from('events')
    .insert([event])
    .select()
    .headers({ 'X-PostgREST-Schema-Cache-Reload': 'true' })
    .single();

  if (error) throw error;
  if (data) await logAudit('CREATE', 'events', data.id, event);
  return data;
}

export async function updateEvent(id: string, updates: any) {
  await verifyAdmin();
  const { data, error } = await supabase
    .from('events')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  if (data) await logAudit('UPDATE', 'events', id, updates);
  return data;
}

export async function createBanner(banner: any) {
  await verifyAdmin();
  const { data, error } = await supabase
    .from('banners')
    .insert([banner])
    .select()
    .headers({ 'X-PostgREST-Schema-Cache-Reload': 'true' })
    .single();

  if (error) throw error;
  if (data) await logAudit('CREATE', 'banners', data.id, banner);
  return data;
}

export async function updateBanner(id: string, updates: any) {
  await verifyAdmin();
  const { data, error } = await supabase
    .from('banners')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  if (data) await logAudit('UPDATE', 'banners', id, updates);
  return data;
}

export async function createAnnouncement(announcement: any) {
  await verifyAdmin();
  const { data, error } = await supabase
    .from('announcements')
    .insert([announcement])
    .select()
    .headers({ 'X-PostgREST-Schema-Cache-Reload': 'true' })
    .single();

  if (error) throw error;
  if (data) await logAudit('CREATE', 'announcements', data.id, announcement);
  return data;
}

export async function updateAnnouncement(id: string, updates: any) {
  await verifyAdmin();
  const { data, error } = await supabase
    .from('announcements')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  if (data) await logAudit('UPDATE', 'announcements', id, updates);
  return data;
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
  // Try author verification first, fallback to admin
  try {
    await verifyAuthor();
  } catch (e) {
    await verifyAdmin();
  }
  
  const { ebook_metadata, ...productData } = product;
  
  // Ensure slug exists
  if (!productData.slug && productData.title) {
    productData.slug = `${generateSlug(productData.title)}-${Math.random().toString(36).substring(2, 7)}`;
  }
  
  const currentData = { ...productData };

  return withRetry(async () => {
    console.log('[API] Creating product with payload:', currentData);
    const { data, error } = await supabase
      .from('products')
      .insert([currentData])
      .select('id, title, slug')
      .headers({ 'X-PostgREST-Schema-Cache-Reload': 'true' })
      .maybeSingle();

    if (error) {
      console.error('[API] Product insertion error:', {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
        payload: currentData
      });

      // PGRST204: Column not found in schema cache
      if (error.code === 'PGRST204' || 
          (error.message?.includes('column') && 
           (error.message?.includes('not found') || error.message?.includes('cache')))) {
        
        // Extract the missing column name from the error message
        // Common formats:
        // "Could not find the 'author_id' column of 'products' in the schema cache"
        // "column 'author_id' does not exist"
        const match = error.message.match(/['"]([^'"]+)['"] column/) || 
                      error.message.match(/column ['"]([^'"]+)['"]/) ||
                      error.message.match(/column ([^ ]+) does not exist/);
        
        if (match && match[1]) {
          const missingCol = match[1];
          // Don't delete 'id' or table name if it somehow matched
          if (missingCol !== 'products' && missingCol !== 'id') {
            console.warn(`[API] Column ${missingCol} missing in products schema cache, filtering and retrying...`);
            delete currentData[missingCol];
            // We throw to trigger withRetry
            throw error;
          }
        } else if (error.message.includes('author_id')) {
          // Hardcoded fallback for the common author_id error reported by user
          console.warn('[API] author_id specifically missing in products schema cache, filtering and retrying...');
          delete currentData['author_id'];
          throw error;
        }
      }
      throw error;
    }

    console.log('[API] Product creation success:', data);
    if (data && productData.type === 'ebook' && ebook_metadata) {
      try {
        console.log('[API] Saving ebook metadata for product:', data.id);
        await supabase.from('ebook_metadata').insert([{
          ...ebook_metadata,
          product_id: data.id
        }]);
      } catch (err) {
        console.warn('Failed to save ebook metadata:', err);
      }
    }

    if (data) {
      await logAudit('CREATE', 'products', data.id, currentData);
    }

    return data;
  }, { retries: 3 });
}

export async function updateProduct(id: string, product: any) {
  // Try author verification first, fallback to admin
  try {
    await verifyAuthor();
  } catch (e) {
    await verifyAdmin();
  }
  
  const { ebook_metadata, ...productData } = product;

  // Get old data for audit - hardened to avoid schema cache issues
  let oldData = null;
  try {
    const productCols = 'id, title, slug, description, price, sale_price, image_url, category_id, stock_quantity, author_id, type, is_active, metadata';
    const { data: minimalData } = await supabase.from('products').select(productCols).eq('id', id).maybeSingle();
    if (minimalData) {
      oldData = minimalData;
    } else {
      const { data: idOnly } = await supabase.from('products').select('id').eq('id', id).maybeSingle();
      oldData = idOnly;
    }
  } catch (e) {
    console.warn('Failed to fetch oldData for product update audit, proceeding...');
  }

  const currentData = { ...productData };

  return withRetry(async () => {
    console.log(`[API] Updating product ${id} with payload:`, currentData);
    const { data, error } = await supabase
      .from('products')
      .update(currentData)
      .eq('id', id)
      .select('id, title, slug')
      .maybeSingle();

    if (error) {
      console.error('[API] Product update error:', {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
        payload: currentData
      });
      // Handle missing columns or schema cache errors
      if (error.code === 'PGRST204' || 
          (error.message?.includes('column') && 
           (error.message?.includes('not found') || error.message?.includes('cache')))) {
        
        const match = error.message.match(/['"]([^'"]+)['"] column/) || 
                      error.message.match(/column ['"]([^'"]+)['"]/) ||
                      error.message.match(/column ([^ ]+) does not exist/);
        
        if (match && match[1]) {
          let missingCol = match[1];
          if (missingCol === 'products') {
            const allMatches = error.message.matchAll(/['"]([^'"]+)['"]/g);
            for (const m of allMatches) {
              if (m[1] !== 'products') {
                missingCol = m[1];
                break;
              }
            }
          }

          if (missingCol !== 'products') {
            console.warn(`Column ${missingCol} missing in products, filtering and retrying...`);
            delete currentData[missingCol];
            throw error; // Trigger retry
          }
        }
      }
      throw error;
    }

    console.log('[API] Product update success:', data);
    if (data && productData.type === 'ebook' && ebook_metadata) {
      try {
        console.log('[API] Updating ebook metadata for product:', id);
        await supabase.from('ebook_metadata')
          .upsert([{
            ...ebook_metadata,
            product_id: id
          }]);
      } catch (err) {
        console.warn('Failed to update ebook metadata:', err);
      }
    }

    await logAudit('UPDATE', 'products', id, currentData, oldData);

    return data;
  });
}

export async function bulkUpdateProducts(ids: string[], updates: any) {
  await verifyAdmin();
  
  const currentUpdates = { ...updates };
  
  return withRetry(async () => {
    const { data, error } = await supabase
      .from('products')
      .update(currentUpdates)
      .in('id', ids)
      .select('id');

    if (error) {
      // Handle missing columns or schema cache errors
      if (error.code === 'PGRST204' || 
          (error.message?.includes('column') && 
           (error.message?.includes('not found') || error.message?.includes('cache')))) {
        
        const match = error.message.match(/['"]([^'"]+)['"] column/) || error.message.match(/column ['"]([^'"]+)['"]/);
        
        if (match && match[1]) {
          const missingCol = match[1];
          if (missingCol === 'products') { // table name matched
            const alternativeMatch = error.message.match(/['"]([^'"]+)['"] column/);
            if (alternativeMatch && alternativeMatch[1]) {
              const realMissingCol = alternativeMatch[1];
              console.warn(`Column ${realMissingCol} missing in products bulk update, filtering...`);
              delete currentUpdates[realMissingCol];
              throw error;
            }
          } else {
            console.warn(`Column ${missingCol} missing in products bulk update, filtering...`);
            delete currentUpdates[missingCol];
            throw error;
          }
        }
      }
      throw error;
    }
    
    return data;
  }, {
    onRetry: (error: any, attempt: number) => {
      console.warn(`Retry attempt ${attempt} for bulkUpdateProducts:`, error.message);
    }
  });
}

/**
 * Specialized Delete for Products with storage cleanup
 */
export async function deleteProduct(id: string) {
  await verifyAdmin();
  
  // 1. Get product data to find associated files
  const { data: product, error: fetchError } = await supabase
    .from('products')
    .select('image_url, ebook_url, type')
    .eq('id', id)
    .single();

  if (fetchError) {
    console.warn('Could not fetch product for deletion cleanup:', fetchError);
  }

  // 2. Delete from database
  const { error: deleteError } = await supabase
    .from('products')
    .delete()
    .eq('id', id);

  if (deleteError) throw deleteError;

  // 3. Log audit
  await logAudit('DELETE', 'products', id, null, product);

  // 4. Cleanup storage (background)
  if (product) {
    if (product.image_url) {
      deleteProductImage(product.image_url).catch(err => console.warn('Image cleanup failed:', err));
    }
    if (product.type === 'ebook' && product.ebook_url) {
      deleteEbookFile(product.ebook_url).catch(err => console.warn('Ebook cleanup failed:', err));
    }
  }

  return true;
}
