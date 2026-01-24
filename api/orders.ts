import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase, json, badRequest, serverError, unauthorized, logAction } from './_utils.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // Basic auth check for sensitive operations
    const authHeader = req.headers.authorization;
    const token = authHeader?.split(' ')[1];
    
    if (req.method === 'POST') {
      if (!token) return unauthorized(res);
      const { data: { user }, error: authError } = await supabase.auth.getUser(token);
      if (authError || !user) return unauthorized(res);

      const orderData = req.body;
      
      // 1. Create the order
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert({
          user_id: user.id,
          subtotal_amount: orderData.subtotal_amount,
          shipping_amount: orderData.shipping_amount,
          shipping_zone_id: orderData.shipping_zone_id,
          shipping_address: orderData.shipping_address,
          status: 'pending'
        })
        .select()
        .single();

      if (orderError) throw orderError;

      // 2. Create order items
      const orderItems = orderData.items.map((item: any) => ({
        order_id: order.id,
        product_id: item.product_id,
        quantity: item.quantity,
        price_at_purchase: item.price,
        product_snapshot: item.product_snapshot
      }));

      const { error: itemsError } = await supabase
        .from('order_items')
        .insert(orderItems);

      if (itemsError) throw itemsError;

      await logAction(req, user.id, 'create_order', 'orders', { orderId: order.id });

      return json(res, 201, order);
    }

    if (req.method === 'GET') {
      const { id } = req.query;
      if (!id) {
        // Fetch all orders (admin check would go here)
        const { data, error } = await supabase.from('orders').select('*, order_items(*)');
        if (error) throw error;
        return json(res, 200, data);
      }

      const { data, error } = await supabase
        .from('orders')
        .select('*, order_items(*, products(*))')
        .eq('id', id)
        .single();

      if (error) throw error;
      return json(res, 200, data);
    }

    return json(res, 405, { error: 'Method not allowed' });
  } catch (err) {
    return serverError(res, err);
  }
}
