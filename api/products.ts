import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase, json, badRequest, serverError } from './_utils.js';

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

      const productColumns = 'id, title, description, price, sale_price, image_url, category_id, stock_quantity, is_active, is_featured, created_at, author_id, ebook_file_path, weight, volume, metadata, ebook_metadata';
      let query = supabase.from('products').select(productColumns);

      if (id) {
        const { data, error } = await query.eq('id', id).single();
        if (error) {
          if (error.code === 'PGRST204' || error.message?.includes('column') || error.message?.includes('cache')) {
            console.warn('Advanced product columns missing, falling back to core columns');
            const { data: fallbackData, error: fallbackError } = await supabase
              .from('products')
              .select('id, title, price, sale_price, image_url, category_id, is_active')
              .eq('id', id)
              .single();
            if (fallbackError) throw fallbackError;
            return json(res, 200, fallbackData);
          }
          throw error;
        }
        return json(res, 200, data);
      }

      if (category) query = query.eq('category_id', category);
      if (featured === 'true') query = query.eq('is_featured', true);

      const { data, error } = await query.order('created_at', { ascending: false });
      if (error) {
        if (error.code === 'PGRST204' || error.message?.includes('column') || error.message?.includes('cache')) {
          console.warn('Advanced product columns missing in list, falling back to core columns');
          
          // If we were filtering by category and it's a UUID, we can still filter
          let fallbackQuery = supabase.from('products').select('id, title, price, sale_price, image_url, category_id, is_active');
          
          if (category) {
            fallbackQuery = fallbackQuery.eq('category_id', category);
          }
          
          if (featured === 'true') {
            fallbackQuery = fallbackQuery.eq('is_featured', true);
          }
          
          const { data: fallbackData, error: fallbackError } = await fallbackQuery.order('created_at', { ascending: false });
          if (fallbackError) throw fallbackError;
          return json(res, 200, fallbackData);
        }
        throw error;
      }
      return json(res, 200, data);
    }

    // Admin operations (POST/PUT) would go here with role checks
    
    return json(res, 405, { error: 'Method not allowed' });
  } catch (err) {
    return serverError(res, err);
  }
}
