import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase, json, badRequest, serverError } from './_utils';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const { type } = req.query;

    if (type === 'book-clubs') {
      const { data, error } = await supabase
        .from('book_clubs')
        .select('*')
        .eq('is_active', true);
      if (error) throw error;
      return json(res, 200, data);
    }

    if (type === 'discussions') {
      const { clubId } = req.query;
      if (!clubId) return badRequest(res, 'clubId is required');

      const { data, error } = await supabase
        .from('club_discussions')
        .select('*, author:profiles(full_name, avatar_url)')
        .eq('club_id', clubId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return json(res, 200, data);
    }

    return json(res, 404, { error: 'Community type not found' });
  } catch (err) {
    return serverError(res, err);
  }
}
