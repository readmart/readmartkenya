import { supabase } from '@/lib/supabase/client';

const PRODUCT_COLUMNS = 'id, title, description, price, sale_price, image_url, category_id, stock_quantity, is_active, created_at, slug, metadata, type, name';
const CORE_PRODUCT_COLUMNS = 'id, title, price, sale_price, is_active, stock_quantity';

/**
 * Fetch products with optional filters with hardening
 */
export async function getProducts(options: {
  category?: string;
  search?: string;
  minPrice?: number;
  maxPrice?: number;
  limit?: number;
  orderBy?: string;
  ascending?: boolean;
} = {}) {
  let query = supabase
    .from('products')
    .select(`${PRODUCT_COLUMNS}, category:categories(name)`)
    .eq('is_active', true);

  if (options.category && options.category !== 'All') {
    // If it's a UUID, search by ID, otherwise search by category name via inner join
    if (options.category.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
      query = query.eq('category_id', options.category);
    } else {
      // Use inner join to filter by category name
      query = supabase
        .from('products')
        .select(`${PRODUCT_COLUMNS}, category:categories!inner(name)`)
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

  const orderBy = options.orderBy || 'created_at';
  const ascending = options.ascending ?? false;

  const { data, error } = await query.order(orderBy, { ascending });

  if (error) {
    if (error.code === 'PGRST204' || error.message?.includes('column') || error.message?.includes('cache')) {
      console.warn('Products list schema cache issue, falling back to core columns');
      
      // If we were filtering by category name, we need to handle that in the fallback
      if (options.category && options.category !== 'All' && !options.category.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
        // Find category ID first
        const { data: categoryData } = await supabase
          .from('categories')
          .select('id')
          .eq('name', options.category)
          .maybeSingle();
        
        if (categoryData) {
          const { data: fallbackData, error: fallbackError } = await supabase
            .from('products')
            .select(CORE_PRODUCT_COLUMNS)
            .eq('is_active', true)
            .eq('category_id', categoryData.id)
            .limit(options.limit || 50);
          
          if (!fallbackError) return fallbackData;
        }
      }

      const { data: fallbackData, error: fallbackError } = await supabase
        .from('products')
        .select(CORE_PRODUCT_COLUMNS)
        .eq('is_active', true)
        .limit(options.limit || 50);
      
      if (fallbackError) throw fallbackError;
      return fallbackData;
    }
    throw error;
  }
  return data;
}

/**
 * Fetch a single product by ID with hardening
 */
export async function getProductById(id: string) {
  try {
    const { data, error } = await supabase
      .from('products')
      .select(`${PRODUCT_COLUMNS}, category:categories(name)`)
      .eq('id', id)
      .maybeSingle();

    if (error) {
      if (error.code === 'PGRST204' || error.message?.includes('column') || error.message?.includes('cache')) {
        console.warn('Product fetch schema cache issue, falling back to core columns');
        const { data: fallbackData, error: fallbackError } = await supabase
          .from('products')
          .select(CORE_PRODUCT_COLUMNS)
          .eq('id', id)
          .maybeSingle();
        
        if (fallbackError) throw fallbackError;
        return fallbackData;
      }
      throw error;
    }
    return data;
  } catch (err) {
    console.error(`Failed to fetch product ${id}:`, err);
    return null;
  }
}

/**
 * Fetch a single product by slug with hardening
 */
export async function getProductBySlug(slug: string) {
  const { data, error } = await supabase
    .from('products')
    .select(`${PRODUCT_COLUMNS}, category:categories(name)`)
    .eq('slug', slug)
    .single();

  if (error) {
    if (error.code === 'PGRST204' || error.message?.includes('column') || error.message?.includes('cache') || error.message?.includes('slug')) {
      console.warn('Product by slug fetch issue, falling back to core columns by ID if possible');
      
      // If slug column itself is missing or cache issue, we can't search by slug
      // But we can try to find it by ID if the slug looks like a UUID
      if (slug.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
        return getProductById(slug);
      }

      const { data: fallbackData, error: fallbackError } = await supabase
        .from('products')
        .select(CORE_PRODUCT_COLUMNS)
        .eq('slug', slug)
        .single();
      
      if (fallbackError) throw fallbackError;
      return fallbackData;
    }
    throw error;
  }
  return data;
}

// Re-exporting specialized functions from dashboards.ts to maintain consistency
// and avoid duplication of complex logic (like ebook metadata handling)
export { 
  createProduct, 
  updateProduct, 
  deleteProduct 
} from './dashboards';
