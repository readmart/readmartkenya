import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase, json, serverError, unauthorized, badRequest } from './_utils.js';

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

      const { data: userData, error: authError } = await supabase.auth.getUser(token);
      const user = userData?.user;
      if (authError || !user) return unauthorized(res);

      // Check if user has purchased the ebook or has an active membership with hardening
      let purchase: any = null;
      let purchaseError: any = null;

      try {
        const { data, error } = await supabase
          .from('order_items')
          .select('id, orders!inner(status, user_id)')
          .eq('product_id', ebookId)
          .eq('orders.user_id', user.id)
          .in('orders.status', ['paid', 'completed', 'delivered'])
          .maybeSingle();
        purchase = data;
        purchaseError = error;
      } catch (e: any) {
        purchaseError = e;
      }

      if (purchaseError) {
        if (purchaseError.code === 'PGRST204' || purchaseError.message?.includes('cache')) {
          console.warn('Order items schema cache issue in ebooks API, falling back to separate fetch');
          // Find orders for this user
          const { data: orders } = await supabase
            .from('orders')
            .select('id, status')
            .eq('user_id', user.id)
            .in('status', ['paid', 'completed', 'delivered']);
          
          if (orders && orders.length > 0) {
            const orderIds = orders.map(o => o.id);
            const { data: item } = await supabase
              .from('order_items')
              .select('id')
              .eq('product_id', ebookId)
              .in('order_id', orderIds)
              .maybeSingle();
            
            purchase = item;
            purchaseError = null;
          }
        } else {
          console.error('Error verifying ebook access:', purchaseError);
          return serverError(res, purchaseError);
        }
      }

      let hasAccess = !!purchase;

      // If no purchase, check for active membership
      if (!hasAccess) {
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('is_member, membership_expires_at')
          .eq('id', user.id)
          .single();

        if (!profileError && profile?.is_member) {
          const now = new Date();
          const expiresAt = profile.membership_expires_at ? new Date(profile.membership_expires_at) : null;
          if (!expiresAt || expiresAt > now) {
            hasAccess = true;
          }
        }
      }

      if (!hasAccess) {
        return json(res, 403, { error: 'Access denied. Purchase or active membership required.' });
      }

      // Fetch the ebook path from products table with hardened error handling
      let ebook: any = null;
      let ebookError: any = null;

      try {
        const { data, error } = await supabase
          .from('products')
          .select('id, title, ebook_file_path, ebook_metadata')
          .eq('id', ebookId)
          .single();
        ebook = data;
        ebookError = error;
      } catch (e: any) {
        ebookError = e;
      }

      if (ebookError) {
        if (ebookError.code === 'PGRST204' || ebookError.message?.includes('cache')) {
          console.warn('Products schema cache issue in ebooks API, falling back to minimal fetch');
          const { data: fallbackEbook, error: fallbackError } = await supabase
            .from('products')
            .select('id, title, ebook_file_path')
            .eq('id', ebookId)
            .single();
          
          if (fallbackError) throw fallbackError;
          ebook = fallbackEbook;
          ebookError = null;
        }
      }

      if (ebookError || !ebook?.ebook_file_path) {
        return json(res, 404, { error: 'Ebook file not found' });
      }

      // Generate a temporary signed URL for the ebook (1 hour)
      const { data: signedData, error: signedError } = await supabase.storage
        .from('ebooks')
        .createSignedUrl(ebook.ebook_file_path, 3600);

      if (signedError) {
        console.error('Error generating signed URL:', signedError);
        return serverError(res, signedError);
      }

      return json(res, 200, { 
        access: 'granted', 
        ebookId,
        title: ebook.title,
        downloadUrl: signedData.signedUrl 
      });
    }

    return json(res, 404, { error: 'Action not found' });
  } catch (err) {
    return serverError(res, err);
  }
}
