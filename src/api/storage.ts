import { supabase } from '@/lib/supabase/client';

/**
 * Upload an image to the products bucket
 * @param file File to upload
 * @param path Optional path within the bucket
 */
export async function uploadProductImage(file: File, path?: string) {
  const fileExt = file.name.split('.').pop();
  const fileName = `${Math.random().toString(36).substring(2)}_${Date.now()}.${fileExt}`;
  const filePath = path ? `${path}/${fileName}` : fileName;

  const { data, error } = await supabase.storage
    .from('products')
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: false
    });

  if (error) throw error;

  // Get public URL
  const { data: { publicUrl } } = supabase.storage
    .from('products')
    .getPublicUrl(data.path);

  return publicUrl;
}

/**
 * Delete an image from the products bucket
 * @param url Full public URL of the image
 */
export async function deleteProductImage(url: string) {
  try {
    const path = url.split('/').pop();
    if (!path) return;

    const { error } = await supabase.storage
      .from('products')
      .remove([path]);

    if (error) throw error;
  } catch (error) {
    console.error('Failed to delete image:', error);
  }
}
