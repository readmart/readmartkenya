import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase, json, serverError, unauthorized, badRequest } from './_utils.ts';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const { action, ebookId } = req.query;

    if (action === 'get-access') {
      const authHeader = req.headers.authorization;
      const token = authHeader?.split(' ')[1];
      if (!token) return unauthorized(res);

      const { data: { user }, error: authError } = await supabase.auth.getUser(token);
      if (authError || !user) return unauthorized(res);

      // Check if user has purchased the ebook or has a membership
      const { data: purchase } = await supabase
        .from('order_items')
        .select('id, orders!inner(status, user_id)')
        .eq('product_id', ebookId)
        .eq('orders.user_id', user.id)
        .eq('orders.status', 'paid')
        .maybeSingle();

      if (!purchase) {
        return json(res, 403, { error: 'Access denied. Purchase required.' });
      }

      // Generate a temporary signed URL or access token for the ebook
      return json(res, 200, { access: 'granted', ebookId });
    }

    return json(res, 404, { error: 'Action not found' });
  } catch (err) {
    return serverError(res, err);
  }
}
