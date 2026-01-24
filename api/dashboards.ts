import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase, json, serverError, unauthorized } from './_utils.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.split(' ')[1];
    if (!token) return unauthorized(res);

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) return unauthorized(res);

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!profile) return unauthorized(res, 'Profile not found');

    if (profile.role === 'founder') {
      // Aggregate stats for founder
      const [orders, products, users] = await Promise.all([
        supabase.from('orders').select('subtotal_amount, status'),
        supabase.from('products').select('count', { count: 'exact', head: true }),
        supabase.from('profiles').select('count', { count: 'exact', head: true })
      ]);

      const totalRevenue = orders.data?.reduce((sum, o) => sum + (o.subtotal_amount || 0), 0) || 0;
      
      return json(res, 200, {
        revenue: totalRevenue,
        ordersCount: orders.data?.length || 0,
        productsCount: products.count,
        usersCount: users.count
      });
    }

    return json(res, 403, { error: 'Forbidden' });
  } catch (err) {
    return serverError(res, err);
  }
}
