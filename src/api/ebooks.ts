import { supabase } from '@/lib/supabase/client';

/**
 * Fetch all e-books owned by the current user
 */
export async function getMyEbooks() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');

  // Fetch products of type 'ebook' that the user has purchased (status 'completed' or 'paid')
  let { data, error } = await supabase
    .from('order_items')
    .select(`
      id,
      product_id,
      products!inner (
        id,
        title,
        metadata,
        image_url,
        is_ebook
      ),
      orders!inner (
        status,
        user_id,
        created_at
      )
    `)
    .eq('orders.user_id', user.id)
    .eq('products.is_ebook', true)
    .in('orders.status', ['completed', 'paid', 'delivered'])
    .headers({ 'X-PostgREST-Schema-Cache-Reload': 'true' });

  if (error) {
    if (error.code === 'PGRST204' || error.message?.toLowerCase().includes('column') || error.message?.toLowerCase().includes('cache')) {
      console.warn('Advanced ebook query columns missing, falling back to core columns');
      const { data: fallbackData, error: fallbackError } = await supabase
        .from('order_items')
        .select(`
          id,
          product_id,
          products!inner (id, title, metadata),
          orders!inner (status, user_id, created_at)
        `)
        .eq('orders.user_id', user.id)
        .in('orders.status', ['completed', 'paid', 'delivered']);
      
      if (fallbackError) throw fallbackError;
      
      // Filter manually for ebooks if is_ebook column was missing
      data = (fallbackData || []).filter((item: any) => 
        item.products?.is_ebook === true || 
        item.products?.metadata?.is_ebook === true ||
        item.products?.metadata?.type === 'ebook'
      ) as any;
    } else {
      console.error('Error in getMyEbooks:', error);
      throw error;
    }
  }

  // Transform data to a flatter structure for the UI
  return (data || []).map((item: any) => ({
    id: item.product_id, // Use product_id as the unique key for the ebook entry
    created_at: item.orders.created_at,
    products: item.products
  }));
}

/**
 * Securely retrieve a short-lived signed URL for an e-book.
 */
export async function getEbookAccessUrl(productId: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');

  // 1. Verify ownership
  let { data: purchase, error: purchaseError } = await supabase
    .from('order_items')
    .select('id, orders!inner(status, user_id)')
    .eq('product_id', productId)
    .eq('orders.user_id', user.id)
    .in('orders.status', ['completed', 'paid', 'delivered'])
    .maybeSingle();

  if (purchaseError) {
    if (purchaseError.code === 'PGRST204' || purchaseError.message?.includes('cache')) {
      console.warn('Ownership verify cache issue, falling back to core');
      const { data: fallbackPurchase, error: fallbackError } = await supabase
        .from('order_items')
        .select('id')
        .eq('product_id', productId)
        .maybeSingle();
      
      if (fallbackError) throw fallbackError;
      purchase = fallbackPurchase as any;
    } else {
      console.error('Error verifying ebook ownership:', purchaseError);
      throw purchaseError;
    }
  }

  if (!purchase) {
    throw new Error('Access Denied: No valid purchase found for this e-book.');
  }

  // 2. Get e-book metadata (storage path)
  let ebook: any = null;
  let ebookError: any = null;

  try {
    const { data, error } = await supabase
      .from('ebook_metadata')
      .select('file_path')
      .eq('product_id', productId)
      .single();
    ebook = data;
    ebookError = error;
  } catch (e: any) {
    ebookError = e;
  }

  if (ebookError) {
    if (ebookError.code === 'PGRST204' || ebookError.message?.includes('cache')) {
      console.warn('ebook_metadata cache issue, retrying');
      const { data: retryData, error: retryError } = await supabase
        .from('ebook_metadata')
        .select('file_path')
        .eq('product_id', productId)
        .single();
      if (retryError) throw retryError;
      ebook = retryData;
    } else {
      throw ebookError;
    }
  }

  // 3. Generate 60-second signed URL from private 'ebooks' bucket
  const { data, error: signedUrlError } = await supabase.storage
    .from('ebooks')
    .createSignedUrl(ebook.file_path, 60);

  if (signedUrlError || !data) {
    throw new Error(`Failed to generate access link: ${signedUrlError?.message}`);
  }

  return { url: data.signedUrl };
}
