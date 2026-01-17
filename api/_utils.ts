import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from './_db.ts';
export { supabase };

export const TAX_RATE = 0.16; // 16% VAT

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

    const ledgerEntries: any[] = [];

    for (const item of items) {
      const price = item.price_at_purchase || item.price || 0;
      const amount = Number(price) * Number(item.quantity);
      
      // Calculate platform commission (default 10% if not found)
      const commissionRate = platformService?.commission_rate || 10;
      const commissionAmount = (amount * (Number(commissionRate) / 100));

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
