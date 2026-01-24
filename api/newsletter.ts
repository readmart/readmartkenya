import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase, json, badRequest, serverError } from './_utils.ts';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    if (req.method === 'POST') {
      const { email } = req.body;
      if (!email) return badRequest(res, 'Email is required');

      const { data, error } = await supabase
        .from('newsletter_subscriptions')
        .insert([{ email, status: 'active' }])
        .select()
        .single();

      if (error) {
        if (error.code === '23505') {
          return json(res, 200, { success: true, message: 'You are already subscribed!' });
        }
        throw error;
      }

      return json(res, 200, { success: true, message: 'Successfully subscribed!' });
    }

    if (req.method === 'GET') {
      const { data, error } = await supabase
        .from('newsletter_subscriptions')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return json(res, 200, data);
    }

    return json(res, 405, { error: 'Method not allowed' });
  } catch (err) {
    return serverError(res, err);
  }
}
