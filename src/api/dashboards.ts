import { supabase } from '@/lib/supabase/client';

// --- Founder Services ---

/**
 * Fetch global analytics for Founders
 */
export async function getGlobalAnalytics() {
  try {
    // Aggregate sales, users, and orders
    // We try to get 'completed' or 'paid' orders for revenue
    // Using a more robust query that handles potential enum issues by fetching all and filtering if needed
    let salesData: any[] = [];
    const { data: sales, error: salesError } = await supabase
      .from('orders')
      .select('total_amount, created_at, status');
    
    if (!salesError && sales) {
      salesData = sales.filter(o => o.status === 'completed' || o.status === 'paid');
    }

    const { count: userCount, error: userError } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true });

    const { count: orderCount, error: orderError } = await supabase
      .from('orders')
      .select('*', { count: 'exact', head: true });

    const { count: productCount, error: productError } = await supabase
      .from('products')
      .select('*', { count: 'exact', head: true });

    if (salesError || userError || orderError || productError) {
      const err = salesError || userError || orderError || productError;
      
      // If it's a 400 error (Bad Request) or RLS issue (which might manifest as 406 or aborted)
      if (err?.code === '42P01' || err?.code === 'PGRST116' || err?.code === '400' || err?.code === '406') {
        console.warn('Analytics tables might not be fully accessible or initialized:', err.message);
        return {
          totalRevenue: 0,
          totalUsers: 0,
          totalOrders: 0,
          totalProducts: 0,
          salesData: [],
          isInitialized: false
        };
      }
      
      console.error('Analytics Fetch Failed:', {
        source: salesError ? 'sales' : userError ? 'users' : orderError ? 'orders' : 'products',
        message: err?.message,
        details: err?.details,
        hint: err?.hint
      });
      // Instead of throwing, we return defaults to keep the UI running
      return {
        totalRevenue: 0,
        totalUsers: 0,
        totalOrders: 0,
        totalProducts: 0,
        salesData: [],
        isInitialized: false
      };
    }

    return {
      totalRevenue: salesData.reduce((acc, curr) => acc + Number(curr.total_amount), 0) || 0,
      totalUsers: userCount || 0,
      totalOrders: orderCount || 0,
      totalProducts: productCount || 0,
      salesData: salesData,
      isInitialized: true
    };
  } catch (error: any) {
    console.warn('Global analytics fetch failed, returning defaults:', error.message);
    return {
      totalRevenue: 0,
      totalUsers: 0,
      totalOrders: 0,
      totalProducts: 0,
      salesData: [],
      isInitialized: false
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
    .select('*')
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
      whatsapp_link: 'https://wa.me/254700000000',
      address: 'Nairobi, Kenya',
      maintenance_mode: false
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
