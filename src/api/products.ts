import { supabase } from '@/lib/supabase/client';
import { verifyRole, logAudit } from '@/lib/utils/api-helpers';

/**
 * Fetch products with optional filters
 */
export async function getProducts(options: {
  category?: string;
  search?: string;
  minPrice?: number;
  maxPrice?: number;
  limit?: number;
} = {}) {
  let query = supabase
    .from('products')
    .select('*, category:categories(name)')
    .eq('is_active', true);

  if (options.category && options.category !== 'All') {
    // If it's a UUID, search by ID, otherwise search by category name via inner join
    if (options.category.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
      query = query.eq('category_id', options.category);
    } else {
      // Use inner join to filter by category name
      query = supabase
        .from('products')
        .select('*, category:categories!inner(name)')
        .eq('is_active', true)
        .eq('category.name', options.category);
    }
  }

  if (options.search) {
    query = query.ilike('title', `%${options.search}%`);
  }

  if (options.minPrice !== undefined) {
    query = query.gte('price', options.minPrice);
  }

  if (options.maxPrice !== undefined) {
    query = query.lte('price', options.maxPrice);
  }

  if (options.limit) {
    query = query.limit(options.limit);
  }

  const { data, error } = await query.order('created_at', { ascending: false });

  if (error) throw error;
  return data;
}

/**
 * Fetch a single product by ID
 */
export async function getProductById(id: string) {
  const { data, error } = await supabase
    .from('products')
    .select('*, category:categories(name)')
    .eq('id', id)
    .single();

  if (error) throw error;
  return data;
}

/**
 * Fetch a single product by slug
 */
export async function getProductBySlug(slug: string) {
  const { data, error } = await supabase
    .from('products')
    .select('*, category:categories(name)')
    .eq('slug', slug)
    .single();

  if (error) throw error;
  return data;
}

// Re-exporting specialized functions from dashboards.ts to maintain consistency
// and avoid duplication of complex logic (like ebook metadata handling)
export { 
  createProduct, 
  updateProduct, 
  deleteProduct 
} from './dashboards';
