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

    const { data: userData, error: authError } = await supabase.auth.getUser(token);
    const user = userData?.user;
    if (authError || !user) return unauthorized(res);

    let { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();

    if (profileError) {
      if (profileError.code === 'PGRST204' || profileError.message?.includes('cache') || profileError.message?.includes('column')) {
        console.warn('Profiles schema cache issue in dashboard, retrying with minimal select');
        const { data: retryProfile, error: retryError } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .maybeSingle();
        if (retryError) throw retryError;
        profile = retryProfile;
      } else {
        throw profileError;
      }
    }

    if (!profile) return unauthorized(res, 'Profile not found');

    if (profile.role === 'founder') {
      // Aggregate stats for founder - hardened against schema cache issues
      let ordersData: any[] = [];
      let productsCount: number | null = 0;
      let usersCount: number | null = 0;

      try {
        const [ordersRes, productsRes, usersRes] = await Promise.all([
          supabase.from('orders').select('total_amount, status'),
          supabase.from('products').select('id', { count: 'exact', head: true }),
          supabase.from('profiles').select('id', { count: 'exact', head: true })
        ]);

        if (ordersRes.error && (ordersRes.error.code === 'PGRST204' || ordersRes.error.message?.includes('cache'))) {
          console.warn('Orders stats cache issue, retrying minimal select');
          const { data } = await supabase.from('orders').select('total_amount');
          ordersData = data || [];
        } else {
          ordersData = ordersRes.data || [];
        }

        productsCount = productsRes.count;
        usersCount = usersRes.count;
      } catch (e) {
        console.error('Failed to fetch dashboard stats:', e);
      }

      const totalRevenue = ordersData.reduce((sum, o) => sum + (o.total_amount || 0), 0) || 0;
      
      return json(res, 200, {
        revenue: totalRevenue,
        ordersCount: ordersData.length,
        productsCount: productsCount,
        usersCount: usersCount
      });
    }

    return json(res, 403, { error: 'Forbidden' });
  } catch (err) {
    return serverError(res, err);
  }
}
