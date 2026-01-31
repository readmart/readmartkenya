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
    await supabase
      .from('audit_logs')
      .insert([{ user_id: userId, action, resource, payload, ip }]);
  } catch (e) {
    console.error('Audit log failed:', e);
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
  const { data, error } = await supabase
    .from('notifications')
    .insert([{ 
      user_id: userId, 
      type, 
      title, 
      message, 
      metadata: { ...metadata, link } 
    }])
    .select()
    .single();
  
  if (error) {
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

    // 1. Get order and items
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('*, order_items(*)')
      .eq('id', orderId)
      .single();
    
    if (orderError || !order) throw orderError || new Error('Order not found');
    
    const items = order.order_items || [];
    
    // 2. Fetch active partnership services to calculate commissions
    const { data: services } = await supabase
      .from('partnership_services')
      .select('*')
      .eq('is_active', true);

    const platformService = services?.find((s: any) => s.name.toLowerCase().includes('platform')) || 
                           services?.find((s: any) => s.name.toLowerCase().includes('readmart'));

    const logisticsService = services?.find((s: any) => s.name.toLowerCase().includes('logistics')) ||
                            services?.find((s: any) => s.name.toLowerCase().includes('shipping'));

    const authorService = services?.find((s: any) => s.name.toLowerCase().includes('author')) ||
                         services?.find((s: any) => s.name.toLowerCase().includes('royalty'));

    const ledgerEntries: any[] = [];

    // 2.1 Calculate Logistics Payout if order has a shipping zone with an assigned partner
    if (order.shipping_zone_id && Number(order.shipping_amount) > 0) {
      const { data: zone } = await supabase
        .from('shipping_zones')
        .select('partner_id')
        .eq('id', order.shipping_zone_id)
        .single();
      
      if (zone?.partner_id) {
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
    }

    // Fetch site settings once for author rates
    const { data: settings } = await supabase.from('site_settings').select('author_commission_rate').single();
    const defaultAuthorRate = settings?.author_commission_rate || 70;

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
      await supabase.from('fulfillment_ledger').insert(ledgerEntries);
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
