import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase, json, badRequest, serverError } from './_utils.ts';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    if (req.method === 'GET') {
      const { id, category, featured } = req.query;

      let query = supabase.from('products').select('*');

      if (id) {
        const { data, error } = await query.eq('id', id).single();
        if (error) throw error;
        return json(res, 200, data);
      }

      if (category) query = query.eq('category', category);
      if (featured === 'true') query = query.eq('is_featured', true);

      const { data, error } = await query.order('created_at', { ascending: false });
      if (error) throw error;
      return json(res, 200, data);
    }

    // Admin operations (POST/PUT) would go here with role checks
    
    return json(res, 405, { error: 'Method not allowed' });
  } catch (err) {
    return serverError(res, err);
  }
}
