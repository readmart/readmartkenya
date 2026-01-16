import { supabase } from '@/lib/supabase/client';

// --- Founder Services ---

/**
 * Fetch global analytics for Founders
 */
export async function getGlobalAnalytics() {
  try {
    // Aggregate sales, users, and orders
    const { data: sales, error: salesError } = await supabase
      .from('orders')
      .select('total_amount, created_at')
      .eq('status', 'completed');

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
      
      // If it's a 400 error (Bad Request), it might be a schema mismatch or missing table
      if (err?.code === '42P01' || err?.code === 'PGRST116' || err?.code === '400') {
        console.warn('Analytics tables might not be fully initialized:', err.message);
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
      throw err;
    }

    return {
      totalRevenue: sales?.reduce((acc, curr) => acc + Number(curr.total_amount), 0) || 0,
      totalUsers: userCount || 0,
      totalOrders: orderCount || 0,
      totalProducts: productCount || 0,
      salesData: sales || [],
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
  const { data, error } = await supabase
    .from('orders')
    .select('*, profiles(full_name, email)')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data;
}

/**
 * Fetch all shipping zones
 */
export async function getShippingZones() {
  const { data, error } = await supabase
    .from('shipping_zones')
    .select('*')
    .order('name');

  if (error) throw error;
  return data;
}

/**
 * Fetch all promo codes
 */
export async function getPromos() {
  const { data, error } = await supabase
    .from('promos')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data;
}

/**
 * Fetch CMS content (banners, etc.)
 */
export async function getCMSContent() {
  const { data, error } = await supabase
    .from('cms_content')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data;
}

/**
 * Fetch audit logs for Founders
 */
export async function getAuditLogs() {
  const { data, error } = await supabase
    .from('audit_logs')
    .select('*, profiles(full_name)')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data;
}

/**
 * Fetch all contact inquiries
 */
export async function getInquiries() {
  const { data, error } = await supabase
    .from('contact_messages')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data;
}

/**
 * Fetch all partnership applications
 */
export async function getPartnerships() {
  const { data, error } = await supabase
    .from('partnership_applications')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data;
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
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .in('role', ['founder', 'admin', 'manager'])
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data;
}

/**
 * Fetch sales report for a specific author
 */
export async function getAuthorSalesReport(authorId: string) {
  const { data, error } = await supabase
    .from('orders')
    .select('*, order_items!inner(*)')
    .eq('order_items.author_id', authorId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data;
}

/**
 * Fetch payouts for a specific partner
 */
export async function getPartnerPayouts(partnerId: string) {
  const { data, error } = await supabase
    .from('fulfillment_ledger')
    .select('*')
    .eq('partner_service_id', partnerId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data;
}

/**
 * Fetch all users for Admin management
 */
export async function getAllUsers() {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data;
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
  const { error } = await supabase
    .from('settings')
    .update(updates)
    .eq('id', 'global'); // Assuming single settings row

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
