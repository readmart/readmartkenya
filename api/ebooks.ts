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

      // Check if user has purchased the ebook or has a membership
      const { data: purchase, error: purchaseError } = await supabase
        .from('order_items')
        .select('id, orders!inner(status, user_id)')
        .eq('product_id', ebookId)
        .eq('orders.user_id', user.id)
        .in('orders.status', ['paid', 'completed', 'delivered'])
        .maybeSingle();

      if (purchaseError) {
        console.error('Error verifying ebook access:', purchaseError);
        return serverError(res, purchaseError);
      }

      if (!purchase) {
        return json(res, 403, { error: 'Access denied. Purchase required.' });
      }

      // Fetch the ebook path from products table
      const { data: ebook, error: ebookError } = await supabase
        .from('products')
        .select('ebook_file_path, title')
        .eq('id', ebookId)
        .single();

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
