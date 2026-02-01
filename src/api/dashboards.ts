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
      supabase.from('profiles').select('id', { count: 'exact', head: true }),
      supabase.from('products').select('id', { count: 'exact', head: true }),
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

    // Revenue from active transactions (excluding cancelled/failed/refunded)
    const EXCLUDED_STATUSES = ['cancelled', 'failed', 'refunded'];
    const activeOrders = currentOrders.filter(o => !EXCLUDED_STATUSES.includes((o.status || 'pending').toLowerCase()));
    
    const currentRevenue = activeOrders.reduce((acc, curr) => {
      const val = Number(curr.total_amount);
      return acc + (isNaN(val) ? 0 : val);
    }, 0);
    
    const previousRevenue = previousOrders
      .filter(o => !EXCLUDED_STATUSES.includes((o.status || 'pending').toLowerCase()))
      .reduce((acc, curr) => {
        const val = Number(curr.total_amount);
        return acc + (isNaN(val) ? 0 : val);
      }, 0);

    const revenueTrend = calculateTrend(currentRevenue, previousRevenue);
    const ordersTrend = calculateTrend(currentOrders.length, previousOrders.length);

    // Group sales data by day for the trajectory chart
    const salesByDay: Record<string, number> = {};
    activeOrders.forEach(order => {
      const day = new Date(order.created_at).toISOString().split('T')[0];
      const val = Number(order.total_amount);
      salesByDay[day] = (salesByDay[day] || 0) + (isNaN(val) ? 0 : val);
    });

    const trajectoryData = Object.entries(salesByDay)
      .map(([date, amount]) => ({ 
        created_at: date, 
        total_amount: amount 
      }))
      .sort((a, b) => a.created_at.localeCompare(b.created_at));

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
    let clubMembersCount = 0;
    try {
      const { count, error: clubError } = await supabase
        .from('book_club_memberships')
        .select('id', { count: 'exact', head: true })
        .eq('is_active', true);
      
      if (clubError) throw clubError;
      clubMembersCount = count || 0;
    } catch (err) {
      console.warn('Club Members Fetch Error:', err);
    }

    // 6. Analytics Processing (Categories & Top Products)
    let categoryStats: any[] = [];
    const unifiedProductSales: Record<string, { title: string, quantity: number, revenue: number }> = {};
    const unifiedCategoryRevenue: Record<string, number> = {};

    try {
      const { data: unifiedData, error: unifiedError } = await supabase
        .from('order_items')
        .select(`
          product_snapshot, 
          quantity, 
          price_at_purchase, 
          orders!inner(created_at, status)
        `)
        .filter('orders.created_at', 'gte', thirtyDaysAgo.toISOString());

      if (unifiedError) {
        console.error('Unified Analytics Query Error:', unifiedError);
        throw unifiedError;
      }

      unifiedData?.forEach(item => {
        const orderStatus = (item.orders as any)?.status?.toLowerCase() || 'pending';
        if (['cancelled', 'failed', 'refunded'].includes(orderStatus)) return;

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
      'Content-Type': 'application/json'
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
      // Explicitly select columns to avoid schema cache issues with '*'
      // We list all columns we expect. If some are missing from the cache, 
      // PostgREST will return 400.
      const { data, error } = await supabase
        .from('shipping_zones')
        .select('id, name, price, rate, base_rate, estimated_days, is_active, country_code, region, postal_codes, shipping_method, weight_surcharge, volume_surcharge, county')
        .order('name');

      if (error) {
        // If it's a "column not found" error (PGRST204 or message includes column name), 
        // try a minimal set of columns that we know exist from the early schema.
        if (error.code === 'PGRST204' || error.message?.includes('column') || error.message?.includes('cache')) {
          console.warn('Advanced shipping columns missing from cache, falling back to core columns');
          const { data: fallbackData, error: fallbackError } = await supabase
            .from('shipping_zones')
            .select('id, name, is_active')
            .order('name');
          
          if (fallbackError) throw fallbackError;
          
          return (fallbackData || []).map(zone => ({
            ...zone,
            price: (zone as any).price ?? (zone as any).rate ?? (zone as any).base_rate ?? 0,
            country_code: 'KE',
            estimated_days: 3,
            shipping_method: 'Standard',
            region: '',
            postal_codes: '',
            weight_surcharge: 0,
            volume_surcharge: 0,
            county: ''
          }));
        }
        throw error;
      }
      
      // Normalize the data to ensure 'price' is always present and other fields have defaults
      const normalizedData = (data || []).map(zone => {
        const price = zone.price ?? (zone as any).rate ?? (zone as any).base_rate ?? 0;
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
          .select('id, name, price, rate, base_rate, estimated_days, is_active, country_code, region, postal_codes, shipping_method, weight_surcharge, volume_surcharge, county');
      } else if (table === 'profiles') {
        query = supabase
          .from(table)
          .select('id, full_name, email, role, avatar_url, bio, created_at');
      } else if (table === 'cms_content') {
        query = supabase
          .from(table)
          .select('id, type, title, content, image_url, is_active, metadata, created_at');
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
          .select('id, full_name, email, pen_name, status, created_at');
      } else if (table === 'contact_messages') {
        query = supabase
          .from(table)
          .select('id, name, email, subject, message, status, created_at');
      } else if (table === 'audit_logs') {
        query = supabase
          .from(table)
          .select('id, actor_id, action, table_name, record_id, created_at');
      } else {
        query = supabase
          .from(table)
          .select('id, created_at');
      }

      const { data, error, status } = await query.order(orderBy, { ascending: false });

      if (error) {
        // Handle schema cache issues
        if (error.code === 'PGRST204' || error.message?.includes('column') || error.message?.includes('cache')) {
          console.warn(`Advanced columns missing for ${table}, falling back to core`);
          const { data: fallbackData, error: fallbackError } = await supabase
            .from(table)
            .select('id, created_at')
            .order(orderBy, { ascending: false });
          
          if (fallbackError) throw fallbackError;
          return fallbackData || [];
        }

        // Handle table not found
        if (status === 404 || error.code === 'PGRST116' || error.message?.includes('not found')) {
          console.warn(`Table ${table} not found, returning empty list`);
          return [];
        }
        throw error;
      }

      // Normalize shipping_zones if fetched successfully
      if (table === 'shipping_zones' && data) {
        return data.map(zone => {
          const price = (zone as any).price ?? (zone as any).rate ?? (zone as any).base_rate ?? 0;
          return {
            ...zone,
            country_code: (zone as any).country_code || 'KE',
            estimated_days: (zone as any).estimated_days || 3,
            shipping_method: (zone as any).shipping_method || 'Standard',
            weight_surcharge: (zone as any).weight_surcharge || 0,
            volume_surcharge: (zone as any).volume_surcharge || 0,
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

      // Explicitly select columns to avoid schema cache issues with '*'
      let query = supabase
        .from('products')
        .select(`
          id, 
          title, 
          author, 
          author_id, 
          price, 
          sale_price, 
          stock_quantity, 
          category_id, 
          image_url, 
          description, 
          is_active, 
          slug, 
          created_at,
          category:categories(name)
        `)
        .order('created_at', { ascending: false });

      if (authorId) {
        query = query.eq('author_id', authorId);
      }

      const { data, error } = await query;

      if (error) {
        // Fallback for products table schema cache issue
        if (error.code === 'PGRST204' || error.message?.includes('column') || error.message?.includes('cache')) {
          console.warn('Advanced product columns missing from cache, falling back to core columns');
          const { data: fallbackData, error: fallbackError } = await supabase
            .from('products')
            .select('id, title, price, stock_quantity, is_active, created_at')
            .order('created_at', { ascending: false });
          
          if (fallbackError) throw fallbackError;
          return fallbackData || [];
        }
        console.error('Error fetching inventory:', error);
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
      } else {
        // Dev bypass mode: assume admin for demonstration if needed, 
        // or check localStorage again. For safety, let's check dev role.
        const devRole = typeof window !== 'undefined' ? localStorage.getItem('rm_dev_role') : null;
        isAdmin = devRole === 'founder' || devRole === 'admin';
      }
      
      let data;
      if (partnerId) {
        // Fetch shipping zones assigned to this partner
        const { data: zones } = await supabase
          .from('shipping_zones')
          .select('id')
          .eq('partner_id', partnerId);
        
        const zoneIds = zones?.map(z => z.id) || [];
        
        if (zoneIds.length === 0) return [];

        // Fetch orders for those zones with customer and item details
        // Hardened: explicit column selection to avoid schema cache issues
        const { data: orders, error } = await supabase
          .from('orders')
          .select(`
            id,
            user_id,
            total_amount,
            subtotal_amount,
            shipping_amount,
            tax_amount,
            status,
            payment_method,
            shipping_address,
            shipping_zone_id,
            created_at,
            profiles(full_name, email),
            order_items(
              id,
              order_id,
              product_id,
              quantity,
              price,
              price_at_purchase,
              product_snapshot,
              product:products(id, title, image_url)
            )
          `)
          .in('shipping_zone_id', zoneIds)
          .order('created_at', { ascending: false });
        
        if (error) throw error;
        data = orders || [];
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
            id,
            user_id,
            total_amount,
            subtotal_amount,
            shipping_amount,
            tax_amount,
            status,
            payment_method,
            shipping_address,
            shipping_zone_id,
            created_at,
            profiles(full_name, email),
            order_items(
              id,
              order_id,
              product_id,
              quantity,
              price,
              price_at_purchase,
              product_snapshot,
              product:products(id, title, image_url)
            )
          `)
          .order('created_at', { ascending: false });

        if (error) {
          console.error('Error fetching all orders:', error);
          throw error;
        }
        data = orders || [];
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

export async function getCMSContent() {
  try {
    // CMS content is public-facing (home page, events, etc.)
    // RLS policies on the database handle the security
    return await getAllRecords('cms_content');
  } catch (err) {
    console.error('CMS Content fetch failed:', err);
    return [];
  }
}

export async function getClubs() {
  try {
    await verifyAdmin();
    const columns = 'id, type, title, content, image_url, is_active, metadata, created_at';
    let { data, error, status } = await supabase
      .from('cms_content')
      .select(columns)
      .eq('type', 'book_club')
      .order('created_at', { ascending: false });

    if (error) {
      if (error.code === 'PGRST204' || error.message?.includes('column') || error.message?.includes('cache')) {
        console.warn('Advanced cms_content columns missing, falling back to core');
        const { data: fallbackData, error: fallbackError } = await supabase
          .from('cms_content')
          .select('id, title, is_active')
          .eq('type', 'book_club')
          .order('created_at', { ascending: false });
        if (fallbackError) throw fallbackError;
        return fallbackData || [];
      }
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
    // Prefer the new events table
    const eventColumns = 'id, title, description, event_date, location, image_url, is_active, created_at';
    let { data, error, status } = await supabase
      .from('events')
      .select(eventColumns)
      .order('event_date', { ascending: false });

    if (error) {
      if (error.code === 'PGRST204' || error.message?.includes('column') || error.message?.includes('cache')) {
        console.warn('Advanced events columns missing, falling back to core');
        const { data: fallbackData, error: fallbackError } = await supabase
          .from('events')
          .select('id, title, event_date')
          .order('event_date', { ascending: false });
        if (!fallbackError) return fallbackData || [];
      }
    }

    if (!error && data) return data;
    
    // If events table missing, fallback to cms_content
    if (status === 404 || error?.code === 'PGRST116') {
      const { data: legacyData, error: legacyError } = await supabase
        .from('cms_content')
        .select('id, type, title, content, image_url, is_active, metadata, created_at')
        .eq('type', 'event')
        .order('created_at', { ascending: false });

      if (!legacyError) return legacyData || [];
    }

    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error('Events fetch failed:', err);
    return [];
  }
}

export async function createEvent(event: any) {
  await verifyAdmin();
  const { data, error } = await supabase
    .from('events')
    .insert([event])
    .select()
    .single();

  if (error) throw error;
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
  return data;
}

export async function getAgreements() {
  try {
    await verifyAdmin();
    const columns = 'id, partner_id, type, status, content, metadata, created_at, signed_at, expires_at';
    let { data, error, status } = await supabase
      .from('agreements')
      .select(`${columns}, partner:profiles(full_name, email)`)
      .order('created_at', { ascending: false });

    if (error) {
      if (error.code === 'PGRST204' || error.message?.includes('column') || error.message?.includes('cache')) {
        console.warn('Advanced agreements columns missing, falling back to core');
        const { data: fallbackData, error: fallbackError } = await supabase
          .from('agreements')
          .select('id, partner_id, status, created_at')
          .order('created_at', { ascending: false });
        if (fallbackError) throw fallbackError;
        return fallbackData || [];
      }
      if (status === 404 || error.code === 'PGRST116') return [];
      throw error;
    }
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
    const columns = 'id, partner_id, type, status, content, metadata, created_at, signed_at, expires_at';
    let { data, error, status } = await supabase
      .from('agreements')
      .select(columns)
      .eq('partner_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      if (error.code === 'PGRST204' || error.message?.includes('column') || error.message?.includes('cache')) {
        console.warn('Advanced user agreements columns missing, falling back to core');
        const { data: fallbackData, error: fallbackError } = await supabase
          .from('agreements')
          .select('id, partner_id, status, created_at')
          .eq('partner_id', userId)
          .order('created_at', { ascending: false });
        if (fallbackError) throw fallbackError;
        return fallbackData || [];
      }
      if (status === 404 || error.code === 'PGRST116') return [];
      throw error;
    }
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
  // 1. Update the agreement record
  // The trigger public.sync_agreement_to_application will handle 
  // updating the application status and the user role automatically.
  const { data: agreement, error: agreementError } = await supabase
    .from('agreements')
    .update({
      signed_url: signedUrl,
      signed_at: new Date().toISOString(),
      status: 'signed'
    })
    .eq('id', agreementId)
    .select()
    .single();

  if (agreementError) throw agreementError;
  return agreement;
}

/**
 * Approve or reject an agreement (Founder only)
 */
export async function updateAgreementStatus(agreementId: string, status: 'approved' | 'rejected', notes?: string) {
  const session = await verifyAdmin();
  const { data, error } = await supabase
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

  if (error) throw error;

  // If approved, ensure the user has the correct role privileges or status
  if (status === 'approved' && data.partner_id) {
    // We might want to update the profile or send a notification
    await supabase.from('profiles').update({
      role: data.type === 'author' ? 'author' : 'partner'
    }).eq('id', data.partner_id);
  }

  return data;
}

export async function getBanners() {
  try {
    await verifyAdmin();
    const columns = 'id, type, title, content, image_url, is_active, metadata, created_at';
    let { data, error } = await supabase
      .from('cms_content')
      .select(columns)
      .eq('type', 'banner')
      .order('created_at', { ascending: false });

    if (error) {
      if (error.code === 'PGRST204' || error.message?.includes('column') || error.message?.includes('cache')) {
        console.warn('Advanced banner columns missing, falling back to core');
        const { data: fallbackData, error: fallbackError } = await supabase
          .from('cms_content')
          .select('id, title, is_active')
          .eq('type', 'banner')
          .order('created_at', { ascending: false });
        if (fallbackError) throw fallbackError;
        return fallbackData || [];
      }
      throw error;
    }
    return data || [];
  } catch (err) {
    console.error('Banners fetch failed:', err);
    return [];
  }
}

export async function getPromos() {
  try {
    await verifyAdmin();
    // Fetch from promos table with explicit columns
    const columns = 'id, title, description, code, type, value, status, start_date, end_date, created_at, creator_id, promo_signature';
    let { data, error } = await supabase
      .from('promos')
      .select(columns)
      .order('created_at', { ascending: false });

    if (error) {
      if (error.code === 'PGRST204' || error.message?.includes('column') || error.message?.includes('cache')) {
        console.warn('Advanced promo columns missing, falling back to core');
        const { data: fallbackData, error: fallbackError } = await supabase
          .from('promos')
          .select('id, title, code, status')
          .order('created_at', { ascending: false });
        if (fallbackError) throw fallbackError;
        return fallbackData || [];
      }
      throw error;
    }
    return data || [];
  } catch (err) {
    console.error('Promos fetch failed:', err);
    return [];
  }
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
    const columns = 'id, promo_id, metric_type, value, metadata, recorded_at';
    let { data, error } = await supabase
      .from('promo_metrics')
      .select(columns)
      .eq('promo_id', promoId)
      .order('recorded_at', { ascending: false });

    if (error) {
      if (error.code === 'PGRST204' || error.message?.includes('column') || error.message?.includes('cache')) {
        console.warn('Advanced promo metrics columns missing, falling back to core');
        const { data: fallbackData, error: fallbackError } = await supabase
          .from('promo_metrics')
          .select('id, promo_id, value, recorded_at')
          .eq('promo_id', promoId)
          .order('recorded_at', { ascending: false });
        if (fallbackError) throw fallbackError;
        data = fallbackData as any;
      } else {
        throw error;
      }
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
    const columns = 'id, promo_id, actor_id, action, previous_state, new_state, created_at';
    let { data, error } = await supabase
      .from('promo_audit_logs')
      .select(`${columns}, actor:profiles(full_name)`)
      .eq('promo_id', promoId)
      .order('created_at', { ascending: false });

    if (error) {
      if (error.code === 'PGRST204' || error.message?.includes('column') || error.message?.includes('cache')) {
        console.warn('Advanced promo audit logs columns missing, falling back to core');
        const { data: fallbackData, error: fallbackError } = await supabase
          .from('promo_audit_logs')
          .select('id, promo_id, action, created_at')
          .eq('promo_id', promoId)
          .order('created_at', { ascending: false });
        if (fallbackError) throw fallbackError;
        data = fallbackData as any;
      } else {
        throw error;
      }
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
      .select('id, utilization_count, discount_value')
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
    await verifyRole(['partner', 'author', 'admin', 'founder']);
    
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

export async function getAuthorPayouts(authorId: string) {
  return getPartnerPayouts(authorId);
}

export async function getAuthorReviews(authorId: string) {
  try {
    await verifyRole(['author', 'admin', 'founder']);
    const { data, error } = await supabase
      .from('reviews')
      .select(`
        *,
        product:products!inner(title, author_id),
        profile:profiles(full_name, avatar_url)
      `)
      .eq('product.author_id', authorId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error('Author Reviews fetch failed:', err);
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
    const columns = 'id, name, content, metadata, is_active, created_at, updated_at';
    let { data, error, status } = await supabase
      .from('partnership_agreements')
      .select(columns)
      .order('created_at', { ascending: false });

    if (error) {
      if (error.code === 'PGRST204' || error.message?.includes('column') || error.message?.includes('cache')) {
        console.warn('Advanced protocol agreements columns missing, falling back to core');
        const { data: fallbackData, error: fallbackError } = await supabase
          .from('partnership_agreements')
          .select('id, name, created_at')
          .order('created_at', { ascending: false });
        if (fallbackError) throw fallbackError;
        data = fallbackData as any;
      } else {
        if (status === 404 || error.code === 'PGRST116') return [];
        throw error;
      }
    }
    return data || [];
  } catch (err) {
    console.error('Protocol Agreements fetch failed:', err);
    return [];
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

export async function updateApplicationStatus(table: string, id: string, status: string, userId?: string, role?: string) {
  await verifyAdmin();
  const result = await updateRecord(table, id, { status });
  
  if (status === 'completed' && userId && role) {
    await updateRecord('profiles', userId, { role });
  }
  
  return result;
}

export async function getApprovedAuthors() {
  try {
    // This function is often used for public author lists
    // RLS policies should ensure only basic info is returned if public
    // or verifyAdmin is needed if it returns sensitive data
    
    // For public display, we might not need admin verification if the query is safe
    // But currently this function returns profiles which might have sensitive info
    // However, it selects specific columns: id, full_name, email
    // Email might be sensitive.
    
    // If this is used in Founder Dashboard, it should be protected.
    // If used in public Author page, it should be public but without email.
    
    // Let's check if we are in a protected context or not.
    // Since we don't pass context, we can try to verify, but catch error.
    
    // Actually, let's keep verifyAdmin but handle the failure better in UI
    // OR if this is used for "Meet our Authors" page, we need a public version.
    
    // Based on user error "Approved Authors fetch failed", it seems to be blocking.
    // Let's make it safe by checking session but not throwing?
    // No, if the user is not admin, they shouldn't see the list IF it's an admin function.
    
    // Wait, the error is in the console log. If it's just a log, maybe it's fine?
    // But if it breaks the page...
    
    // If this is ONLY used in Founder Dashboard, then the error is correct for non-admins.
    // But why is Founder Dashboard fetching if I'm not on it?
    // Maybe the user IS on it?
    
    await verifyAdmin();
    let { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, email')
      .eq('role', 'author')
      .order('full_name');
    
    // Fallback if any 400 error (likely role filter or column issue)
    if (error) {
      console.warn('Profiles role filter failed, retrying without filter.');
      const { data: allData, error: allErr } = await supabase
        .from('profiles')
        .select('id, full_name, email, role')
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
    const columns = 'id, site_name, contact_email, contact_phone, secondary_phone, whatsapp_link, author_of_the_day_id, author_of_the_day_books, created_at, updated_at, tax_rate';
    let { data: siteData, error: siteError } = await supabase
      .from('site_settings')
      .select(columns)
      .maybeSingle();

    if (siteError) {
      if (siteError.code === 'PGRST204' || siteError.code === 'PGRST100' || siteError.message?.includes('column') || siteError.message?.includes('cache') || (siteError as any).status === 400) {
        console.warn('Advanced site settings columns missing, falling back to core');
        const { data: fallbackData, error: fallbackError } = await supabase
          .from('site_settings')
          .select('id, site_name, contact_email')
          .maybeSingle();
        if (fallbackError) throw fallbackError;
        siteData = fallbackData as any;
      } else {
        throw siteError;
      }
    }
    if (!siteData) return {};

    // Sanitize dummy numbers
    const sanitizedData: any = { ...siteData };
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
  
  let currentRecord = { ...record };
  
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
          
          // Improved regex to prioritize the column name over the table name
          // The error message usually says: Could not find the 'column_name' column of 'table_name' ...
          const match = error.message.match(/['"]([^'"]+)['"] column/) || error.message.match(/column ['"]([^'"]+)['"]/);
          
          if (match && match[1]) {
            const missingCol = match[1];
            // If the match is the table name, try to find the column name elsewhere in the message
            if (missingCol === table) {
              const alternativeMatch = error.message.match(/['"]([^'"]+)['"] column/);
              if (alternativeMatch && alternativeMatch[1]) {
                const realMissingCol = alternativeMatch[1];
                console.warn(`Detected missing column ${realMissingCol} in ${table} (table name was matched first)`);
                delete currentRecord[realMissingCol];
                throw error;
              }
            } else {
              console.warn(`Column ${missingCol} missing in ${table}, filtering and retrying...`);
              delete currentRecord[missingCol];
              throw error; 
            }
          }
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
    onRetry: (error, attempt) => {
      console.warn(`Retry attempt ${attempt} for createRecord on ${table}:`, error.message);
    }
  });
}

/**
 * Generic Update with Retry and Audit
 */
export async function updateRecord(table: string, id: string, updates: any) {
  await verifyAdmin();
  
  let currentUpdates = { ...updates };
  
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
            fullDataQuery = supabase.from(table).select('id, title, price, stock_quantity, is_active').eq('id', id).maybeSingle();
          } else if (table === 'profiles') {
            fullDataQuery = supabase.from(table).select('id, full_name, email, role').eq('id', id).maybeSingle();
          } else if (table === 'orders') {
            fullDataQuery = supabase.from(table).select('id, status, total_amount, user_id').eq('id', id).maybeSingle();
          } else if (table === 'site_settings') {
            fullDataQuery = supabase.from(table).select('id, site_name, contact_email').eq('id', id).maybeSingle();
          } else {
            // For unknown tables, we use a very minimal set
            fullDataQuery = supabase.from(table).select('id, created_at').eq('id', id).maybeSingle();
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
          
          const match = error.message.match(/['"]([^'"]+)['"] column/) || error.message.match(/column ['"]([^'"]+)['"]/);
          
          if (match && match[1]) {
            const missingCol = match[1];
            if (missingCol === table) {
              const alternativeMatch = error.message.match(/['"]([^'"]+)['"] column/);
              if (alternativeMatch && alternativeMatch[1]) {
                const realMissingCol = alternativeMatch[1];
                console.warn(`Detected missing column ${realMissingCol} in ${table} (table name was matched first)`);
                delete currentUpdates[realMissingCol];
                throw error;
              }
            } else {
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
    onRetry: (error, attempt) => {
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
          fullDataQuery = supabase.from(table).select('id, title, price, stock_quantity, is_active').eq('id', id).maybeSingle();
        } else if (table === 'profiles') {
          fullDataQuery = supabase.from(table).select('id, full_name, email, role').eq('id', id).maybeSingle();
        } else if (table === 'orders') {
          fullDataQuery = supabase.from(table).select('id, status, total_amount, user_id').eq('id', id).maybeSingle();
        } else if (table === 'site_settings') {
          fullDataQuery = supabase.from(table).select('id, site_name, contact_email').eq('id', id).maybeSingle();
        } else {
          // For unknown tables, we use a very minimal set
          fullDataQuery = supabase.from(table).select('id, created_at').eq('id', id).maybeSingle();
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
    onRetry: (error, attempt) => {
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
  
  let currentData = { ...productData };

  return withRetry(async () => {
    console.log('[API] Creating product with payload:', currentData);
    const { data, error } = await supabase
      .from('products')
      .insert([currentData])
      .select('id, title, slug')
      .maybeSingle();

    if (error) {
      console.error('[API] Product insertion error:', {
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
        // Handle different error formats:
        // 1. "column 'name' not found"
        // 2. "Could not find the 'name' column... in the schema cache"
        const match = error.message.match(/column ['"](.+)['"]/) || error.message.match(/['"](.+)['"] column/);
        if (match && match[1]) {
          const missingCol = match[1];
          console.warn(`Column ${missingCol} missing in products, filtering and retrying...`);
          delete currentData[missingCol];
          throw error; // Trigger retry
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

  let currentData = { ...productData };

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
        // Handle different error formats:
        // 1. "column 'name' not found"
        // 2. "Could not find the 'name' column... in the schema cache"
        const match = error.message.match(/column ['"](.+)['"]/) || error.message.match(/['"](.+)['"] column/);
        if (match && match[1]) {
          const missingCol = match[1];
          console.warn(`Column ${missingCol} missing in products, filtering and retrying...`);
          delete currentData[missingCol];
          throw error; // Trigger retry
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
  
  let currentUpdates = { ...updates };
  
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
    onRetry: (error, attempt) => {
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
