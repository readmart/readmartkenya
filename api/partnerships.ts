import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase, json, badRequest, unauthorized, serverError, logAction } from './_utils.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const { action, id } = req.query;

  try {
    // --- AUTHENTICATION ---
    const authHeader = req.headers.authorization;
    let user: any = null;
    
    if (authHeader) {
      const token = authHeader.split(' ')[1];
      const { data } = await supabase.auth.getUser(token);
      user = data?.user;
    }

    // --- GET PARTNERS / TIERS (PUBLIC) ---
    if (req.method === 'GET') {
      if (action === 'tiers') {
        const { data, error } = await supabase
          .from('partnership_tiers')
          .select('*')
          .eq('is_active', true)
          .order('display_order', { ascending: true });
        if (error) throw error;
        return json(res, 200, data);
      }

      if (id) {
        const { data, error } = await supabase
          .from('partners')
          .select('*, tier:partnership_tiers(*)')
          .eq('id', id)
          .single();
        if (error) throw error;
        return json(res, 200, data);
      }

      const { data, error } = await supabase
        .from('partners')
        .select('*, tier:partnership_tiers(name, color_code)')
        .eq('status', 'active')
        .order('is_featured', { ascending: false });
      if (error) throw error;
      return json(res, 200, data);
    }

    // --- ADMIN ONLY OPERATIONS ---
    if (!user) return unauthorized(res, 'Authentication required');
    
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    const isAdmin = profile?.role === 'admin' || profile?.role === 'founder';

    if (req.method === 'POST') {
      if (!isAdmin) return unauthorized(res, 'Admin access required');
      
      const table = action === 'tiers' ? 'partnership_tiers' : 'partners';
      const { data, error } = await supabase
        .from(table)
        .insert([req.body])
        .select()
        .single();
      
      if (error) throw error;
      await logAction(req, user.id, `create_${table.slice(0, -1)}`, table, { recordId: data.id });
      return json(res, 201, data);
    }

    if (req.method === 'PUT') {
      if (!id) return badRequest(res, 'Missing record ID');
      
      const table = action === 'tiers' ? 'partnership_tiers' : 'partners';

      // For partners table, check ownership if not admin
      if (table === 'partners' && !isAdmin) {
        const { data: existingPartner } = await supabase
          .from('partners')
          .select('user_id')
          .eq('id', id)
          .single();

        if (existingPartner?.user_id !== user.id) {
          return unauthorized(res, 'You do not have permission to update this partner');
        }
      } else if (table === 'partnership_tiers' && !isAdmin) {
        return unauthorized(res, 'Admin access required to update tiers');
      }

      const { data, error } = await supabase
        .from(table)
        .update(req.body)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      await logAction(req, user.id, `update_${table.slice(0, -1)}`, table, { recordId: id });
      return json(res, 200, data);
    }

    if (req.method === 'DELETE') {
      if (!isAdmin) return unauthorized(res, 'Admin access required');
      if (!id) return badRequest(res, 'Missing record ID');

      const table = action === 'tiers' ? 'partnership_tiers' : 'partners';
      const { error } = await supabase
        .from(table)
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      await logAction(req, user.id, `delete_${table.slice(0, -1)}`, table, { recordId: id });
      return json(res, 204, null);
    }

    return badRequest(res, 'Method not allowed');
  } catch (err: any) {
    console.error('Partnership API Error:', err);
    return serverError(res, err.message);
  }
}
