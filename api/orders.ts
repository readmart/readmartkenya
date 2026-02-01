import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase, json, badRequest, serverError, unauthorized, logAction } from './_utils.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers are handled by vercel.json

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // Basic auth check for sensitive operations
    const authHeader = req.headers.authorization;
    const token = authHeader?.split(' ')[1];
    
    if (req.method === 'POST') {
      if (!token) return unauthorized(res);
      let user = null;
      try {
        const { data: userData, error: authError } = await supabase.auth.getUser(token);
        user = userData?.user;
        if (authError || !user) return unauthorized(res);
      } catch (e) {
        console.error('Auth verification failed in orders API:', e);
        return unauthorized(res);
      }

      const orderData = req.body || {};
      
      // 1. Create the order with hardened error handling for schema cache issues
      const orderInsertData: any = {
        user_id: user.id,
        subtotal_amount: orderData.subtotal_amount,
        shipping_amount: orderData.shipping_amount,
        shipping_address: orderData.shipping_address,
        status: 'pending',
        payment_method: orderData.payment_method || 'm-pesa'
      };

      if (orderData.shipping_zone_id && orderData.shipping_zone_id.trim() !== '') {
        orderInsertData.shipping_zone_id = orderData.shipping_zone_id;
      }

      let order: any = null;
      let orderError: any = null;

      try {
        const { data, error } = await supabase
          .from('orders')
          .insert(orderInsertData)
          .select('id, user_id, status, total_amount, payment_status, is_paid, created_at')
          .single();
        order = data;
        orderError = error;
      } catch (e: any) {
        orderError = e;
      }

      if (orderError) {
        // Handle schema cache issues (PGRST204 or column not found)
        if (orderError.code === 'PGRST204' || orderError.message?.includes('cache') || orderError.message?.includes('column')) {
          console.warn('Orders schema cache issue during creation, retrying with filtered payload');
          const match = orderError.message.match(/column ['"](.+)['"]/) || orderError.message.match(/['"](.+)['"] column/);
          if (match && match[1]) {
            const missingCol = match[1];
            delete orderInsertData[missingCol];
            // Retry once
            const { data: retryData, error: retryError } = await supabase
              .from('orders')
              .insert(orderInsertData)
              .select('id, user_id, status, created_at')
              .single();
            order = retryData;
            orderError = retryError;
          }
        }
      }

      if (orderError || !order) {
        console.error('Order creation error in API handler:', orderError);
        throw orderError || new Error('Order creation failed');
      }

      // 2. Create order items with hardened error handling
      const orderItems = orderData.items.map((item: any) => ({
        order_id: order.id,
        product_id: item.product_id,
        quantity: item.quantity,
        price_at_purchase: item.price,
        product_snapshot: item.product_snapshot
      }));

      try {
        const { error: itemsError } = await supabase
          .from('order_items')
          .insert(orderItems);
        
        if (itemsError) {
          if (itemsError.code === 'PGRST204' || itemsError.message?.includes('cache') || itemsError.message?.includes('column')) {
            console.warn('order_items schema cache issue during creation, retrying with minimal payload');
            // Minimal items payload
            const minimalItems = orderData.items.map((item: any) => ({
              order_id: order.id,
              product_id: item.product_id,
              quantity: item.quantity,
              price_at_purchase: item.price
            }));
            const { error: retryItemsError } = await supabase
              .from('order_items')
              .insert(minimalItems);
            if (retryItemsError) throw retryItemsError;
          } else {
            throw itemsError;
          }
        }
      } catch (e) {
        console.error('Order items insertion error:', e);
        throw e;
      }

      await logAction(req, user.id, 'create_order', 'orders', { orderId: order.id });

      return json(res, 201, order);
    }

    if (req.method === 'GET') {
      const { id } = req.query;
      if (!id) {
        // Fetch all orders (admin check would go here)
        const orderColumns = 'id, user_id, status, total_amount, payment_status, is_paid, created_at, shipping_address';
        const { data, error } = await supabase
          .from('orders')
          .select(`${orderColumns}, order_items(id, product_id, quantity, price_at_purchase)`);
        
        if (error) {
          if (error.code === 'PGRST204' || error.message?.includes('column') || error.message?.includes('cache')) {
            console.warn('Orders list schema cache issue, falling back to core columns');
            const { data: fallbackData, error: fallbackError } = await supabase
              .from('orders')
              .select('id, user_id, status, is_paid, created_at');
            if (fallbackError) throw fallbackError;
            return json(res, 200, fallbackData);
          }
          throw error;
        }
        return json(res, 200, data);
      }

      const orderColumns = 'id, user_id, status, total_amount, shipping_amount, subtotal_amount, payment_status, is_paid, payment_method, shipping_address, created_at';
      const itemColumns = 'id, order_id, product_id, quantity, price_at_purchase, product_snapshot';
      const productColumns = 'id, title, image_url, price, sale_price, type';

      const { data, error } = await supabase
        .from('orders')
        .select(`
          ${orderColumns},
          order_items(
            ${itemColumns},
            products(${productColumns})
          )
        `)
        .eq('id', id)
        .single();

      if (error) {
        if (error.code === 'PGRST204' || error.message?.includes('column') || error.message?.includes('cache')) {
          console.warn('Single order fetch schema cache issue, falling back to core columns');
          const { data: fallbackOrder, error: fallbackError } = await supabase
            .from('orders')
            .select('id, user_id, status, is_paid, created_at')
            .eq('id', id)
            .single();
          
          if (fallbackError) throw fallbackError;

          // Fetch items separately if join failed
          const { data: items } = await supabase
            .from('order_items')
            .select('id, product_id, quantity, price_at_purchase')
            .eq('order_id', id);
          
          return json(res, 200, { ...fallbackOrder, order_items: items || [] });
        }
        throw error;
      }
      return json(res, 200, data);
    }

    return json(res, 405, { error: 'Method not allowed' });
  } catch (err) {
    return serverError(res, err);
  }
}
