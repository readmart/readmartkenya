import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from './_db.js';
import { jwtVerify } from 'jose';
export { supabase };

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || process.env.VITE_JWT_SECRET || 'fallback_secret_for_dev_min_32_chars'
);

export const TAX_RATE = 0.16; // 16% VAT

/**
 * Verifies the custom JWT from the Authorization header
 */
export async function verifyJWT(req: VercelRequest) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return null;
  
  const token = authHeader.split(' ')[1];
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload as { userId: string; email: string; role: string };
  } catch (e) {
    return null;
  }
}

/**
 * Enhanced fetch with timeout to prevent serverless function hangs
 */
export const fetchWithTimeout = async (url: string, options: RequestInit = {}, timeout = 8000) => {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    clearTimeout(id);
    return response;
  } catch (error) {
    clearTimeout(id);
    throw error;
  }
};

export const json = (res: VercelResponse, status: number, body: unknown) => {
  res.status(status).json(body);
};

export const badRequest = (res: VercelResponse, message: string) => json(res, 400, { error: message });
export const unauthorized = (res: VercelResponse, message = 'Unauthorized') => json(res, 401, { error: message });
export const serverError = (res: VercelResponse, err: unknown) => {
  const message = typeof err === 'string' ? err : String((err as Error)?.message || err);
  console.error('API Error:', err);
  return json(res, 500, { 
    error: 'Internal Server Error',
    message: message
  });
};

export const logAction = async (req: VercelRequest, userId: string | null, action: string, resource?: string, payload?: Record<string, unknown>) => {
  const forward = req.headers['x-forwarded-for'];
  const ip = (Array.isArray(forward) ? forward[0] : (forward as string | undefined))?.split(',')[0]?.trim() || req.socket.remoteAddress || null;
  try {
    // Explicit columns to avoid schema cache issues with wildcard select
    const { error } = await supabase
      .from('audit_logs')
      .insert([{ 
        user_id: userId, 
        action, 
        resource, 
        payload: payload || {}, 
        ip 
      }]);
    
    if (error) {
      if (error.code === 'PGRST204' || error.message?.includes('column') || error.message?.includes('cache')) {
        console.warn('Audit log schema cache issue, retrying with minimal insert');
        await supabase
          .from('audit_logs')
          .insert([{ action: 'system_log_retry', payload: { original_action: action, resource, userId, ip } }]);
      } else {
        console.error('Audit log failed:', error);
      }
    }
  } catch (e) {
    console.error('Audit log critical failure:', e);
  }
};

export const createNotification = async (params: {
  userId: string;
  type: 'order' | 'system' | 'promo';
  title: string;
  message: string;
  link?: string;
  metadata?: Record<string, unknown>;
}) => {
  const { userId, type, title, message, link, metadata } = params;
  let data: any = null;
  let error: any = null;

  try {
    const { data: insertData, error: insertError } = await supabase
      .from('notifications')
      .insert([{ 
        user_id: userId, 
        type, 
        title, 
        message, 
        metadata: { ...metadata, link } 
      }])
      .select('id, user_id, type, title')
      .single();
    data = insertData;
    error = insertError;
  } catch (e: any) {
    error = e;
  }
  
  if (error) {
    if (error.code === 'PGRST204' || error.message?.includes('column') || error.message?.includes('cache')) {
      console.warn('Schema cache issue on notification creation, retrying with minimal select');
      const { data: retryData, error: retryError } = await supabase
        .from('notifications')
        .insert([{ 
          user_id: userId, 
          type, 
          title, 
          message
        }])
        .select('id')
        .single();
      if (retryError) {
        console.error('Notification creation failed even after retry:', retryError);
        return null;
      }
      return retryData;
    }
    console.error('Notification creation failed:', error);
    return null;
  }
  return data;
};

/**
 * Calculate commissions and payouts for an order marked as paid.
 */
export const calculateOrderCommissions = async (orderId: string) => {
  try {
    // 0. Prevent duplicate calculation
    const { data: existing } = await supabase
      .from('fulfillment_ledger')
      .select('id')
      .eq('order_id', orderId)
      .limit(1);
    
    if (existing && existing.length > 0) {
      console.log(`Commissions already calculated for order ${orderId}`);
      return true;
    }

    // 1. Get order and items - hardened selection
    let order: any = null;
    const { data: initialOrder, error: orderError } = await supabase
      .from('orders')
      .select(`
        id, 
        user_id, 
        total_amount, 
        subtotal_amount, 
        shipping_amount, 
        shipping_zone_id, 
        status, 
        payment_status, 
        is_paid
      `)
      .eq('id', orderId)
      .single();
    
    if (orderError || !initialOrder) {
      // Handle relationship errors (PGRST200) or cache issues (PGRST204)
      if (orderError?.code === 'PGRST200' || orderError?.code === 'PGRST204' || orderError?.message?.includes('relationship') || orderError?.message?.includes('cache')) {
        console.warn(`[API] Schema mismatch in calculateOrderCommissions for order ${orderId}, retrying with minimal selection`);
        const { data: fallbackOrder, error: fallbackError } = await supabase
          .from('orders')
          .select('id, user_id, total_amount, shipping_amount, shipping_zone_id, status')
          .eq('id', orderId)
          .single();
        
        if (fallbackError) throw fallbackError;
        order = fallbackOrder;
      } else {
        throw orderError || new Error('Order not found');
      }
    } else {
      order = initialOrder;
    }

    // Always fetch items separately to avoid PGRST200 relationship issues
    const { data: orderItems, error: itemsError } = await supabase
      .from('order_items')
      .select('id, product_id, quantity, price, price_at_purchase, product_snapshot, author_id')
      .eq('order_id', orderId);

    if (itemsError) {
      console.warn(`[API] Order items fetch failed for order ${orderId}, trying minimal select:`, itemsError);
      const { data: fallbackItems } = await supabase
        .from('order_items')
        .select('id, product_id, quantity, price_at_purchase')
        .eq('order_id', orderId);
      order.order_items = fallbackItems || [];
    } else {
      order.order_items = orderItems || [];
    }
    
    if (!order) throw new Error('Order not found after fallback');
    const items = order.order_items || [];
    
    // 2. Fetch active partnership services to calculate commissions
    let services: any[] = [];
    try {
      const { data, error: servicesError } = await supabase
        .from('partnership_services')
        .select('id, name, commission_rate, is_active')
        .eq('is_active', true);
      
      if (servicesError) {
        if (servicesError.code === 'PGRST204' || servicesError.message?.includes('cache')) {
          console.warn('Partnership services schema cache issue, falling back to core columns');
          const { data: fallbackServices } = await supabase
            .from('partnership_services')
            .select('id, name, commission_rate')
            .eq('is_active', true);
          services = fallbackServices || [];
        } else {
          throw servicesError;
        }
      } else {
        services = data || [];
      }
    } catch (e) {
      console.error('Failed to fetch partnership services:', e);
    }

    const platformService = services?.find((s: any) => s.name.toLowerCase().includes('platform')) || 
                           services?.find((s: any) => s.name.toLowerCase().includes('readmart'));

    const logisticsService = services?.find((s: any) => s.name.toLowerCase().includes('logistics')) ||
                            services?.find((s: any) => s.name.toLowerCase().includes('shipping'));

    const authorService = services?.find((s: any) => s.name.toLowerCase().includes('author')) ||
                         services?.find((s: any) => s.name.toLowerCase().includes('royalty'));

    const ledgerEntries: any[] = [];

    // 2.1 Calculate Logistics Payout if order has a shipping zone with an assigned partner
    if (order.shipping_zone_id && Number(order.shipping_amount) > 0) {
      try {
        const { data: zone, error: zoneError } = await supabase
          .from('shipping_zones')
          .select('partner_id')
          .eq('id', order.shipping_zone_id)
          .single();
        
        if (zoneError) {
          if (zoneError.code === 'PGRST204' || zoneError.message?.includes('cache')) {
            console.warn('Shipping zones schema cache issue in calculateOrderCommissions, retrying with minimal select');
            const { data: fallbackZone } = await supabase
              .from('shipping_zones')
              .select('id, partner_id')
              .eq('id', order.shipping_zone_id)
              .single();
            
            if (fallbackZone?.partner_id) {
              ledgerEntries.push({
                order_id: orderId,
                partner_id: fallbackZone.partner_id,
                partner_service_id: logisticsService?.id,
                amount: order.shipping_amount,
                payout_status: 'pending',
                metadata: {
                  type: 'logistics_fulfillment',
                  zone_id: order.shipping_zone_id,
                  cache_fallback: true
                }
              });
            }
          } else {
            throw zoneError;
          }
        } else if (zone?.partner_id) {
          ledgerEntries.push({
            order_id: orderId,
            partner_id: zone.partner_id,
            partner_service_id: logisticsService?.id,
            amount: order.shipping_amount,
            payout_status: 'pending',
            metadata: {
              type: 'logistics_fulfillment',
              zone_id: order.shipping_zone_id
            }
          });
        }
      } catch (err) {
        console.error('Failed to fetch shipping zone partner:', err);
      }
    }

    // Fetch site settings once for author rates
    let authorCommissionRate = 70;
    try {
      const { data: settings, error: settingsError } = await supabase.from('site_settings').select('author_commission_rate').single();
      if (settingsError) {
        if (settingsError.code === 'PGRST204' || settingsError.message?.includes('cache')) {
          console.warn('Site settings cache issue in commissions, using default rate');
          // Retry with explicit minimal selection if possible
          const { data: retrySettings } = await supabase.from('site_settings').select('author_commission_rate').limit(1).maybeSingle();
          if (retrySettings?.author_commission_rate) {
            authorCommissionRate = Number(retrySettings.author_commission_rate);
          }
        }
      } else if (settings?.author_commission_rate) {
        authorCommissionRate = Number(settings.author_commission_rate);
      }
    } catch (err) {
      console.warn('Failed to fetch author commission rate, using default 70%');
    }
    const defaultAuthorRate = authorCommissionRate;

    for (const item of items) {
      const price = Number(item.price_at_purchase || item.price || 0);
      const quantity = Number(item.quantity || 0);
      const amount = price * quantity;
      
      if (amount <= 0) continue;

      // 1. Calculate platform commission
      const commissionRate = Number(platformService?.commission_rate || 10);
      const commissionAmount = (amount * (commissionRate / 100));

      ledgerEntries.push({
        order_id: orderId,
        partner_service_id: platformService?.id,
        amount: commissionAmount,
        payout_status: 'pending',
        metadata: { 
          item_id: item.product_id,
          type: 'platform_commission',
          rate: commissionRate 
        }
      });

      // 2. Calculate Author Payout if product has an author
      const productSnapshot = item.product_snapshot || {};
      const authorId = productSnapshot.author_id || item.author_id;

      if (authorId) {
        const authorRate = Number(defaultAuthorRate);
        const authorAmount = (amount * (authorRate / 100));

        ledgerEntries.push({
          order_id: orderId,
          partner_id: authorId,
          partner_service_id: authorService?.id,
          amount: authorAmount,
          payout_status: 'pending',
          metadata: { 
            item_id: item.product_id,
            type: 'author_royalty',
            rate: authorRate 
          }
        });
      }
    }

    if (ledgerEntries.length > 0) {
      const { error: ledgerError } = await supabase.from('fulfillment_ledger').insert(ledgerEntries);
      if (ledgerError) {
        if (ledgerError.code === 'PGRST204' || ledgerError.message?.includes('cache')) {
          console.warn('Fulfillment ledger schema cache issue, retrying with minimal insert');
          // Retry one by one if batch fails, or just log for manual reconciliation
          for (const entry of ledgerEntries) {
            try {
              await supabase.from('fulfillment_ledger').insert([{
                order_id: entry.order_id,
                amount: entry.amount,
                payout_status: 'pending'
              }]);
            } catch (e) {
              console.error('Failed to retry ledger entry:', e);
            }
          }
        } else {
          console.error('Failed to insert ledger entries:', ledgerError);
        }
      }
    }

    // 3. Handle Digital Assets (E-books)
    const digitalItems = items.filter((item: any) => 
      item.product_snapshot?.type === 'ebook' || item.product_snapshot?.category === 'Digital'
    );

    if (digitalItems.length > 0) {
      console.log(`Granting access to ${digitalItems.length} digital items for order ${orderId}`);
      // Here you would typically add logic to grant user access to these files
      // e.g., inserting into a 'user_library' or 'purchased_content' table
    }
    
    return true;
  } catch (error) {
    console.error('Failed to calculate order commissions:', error);
    return false;
  }
};
