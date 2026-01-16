import { supabase } from '@/lib/supabase/client';

/**
 * Fetch all e-books owned by the current user
 */
export async function getMyEbooks() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');

  // Fetch products of type 'ebook' that the user has purchased (status 'completed' or 'paid')
  const { data, error } = await supabase
    .from('order_items')
    .select(`
      id,
      product_id,
      products!inner (
        id,
        title,
        author,
        image_url,
        type
      ),
      orders!inner (
        status,
        user_id,
        created_at
      )
    `)
    .eq('orders.user_id', user.id)
    .eq('products.type', 'ebook')
    .in('orders.status', ['completed', 'paid']);

  if (error) throw error;

  // Transform data to a flatter structure for the UI
  return data.map((item: any) => ({
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
  const { data: purchase, error: purchaseError } = await supabase
    .from('order_items')
    .select('id, orders!inner(status, user_id)')
    .eq('product_id', productId)
    .eq('orders.user_id', user.id)
    .in('orders.status', ['completed', 'paid'])
    .maybeSingle();

  if (purchaseError || !purchase) {
    throw new Error('Access Denied: No valid purchase found for this e-book.');
  }

  // 2. Get e-book metadata (storage path)
  const { data: ebook, error: ebookError } = await supabase
    .from('ebook_metadata')
    .select('file_path')
    .eq('product_id', productId)
    .single();

  if (ebookError || !ebook) {
    throw new Error('Asset Not Found: E-book file path not configured.');
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
