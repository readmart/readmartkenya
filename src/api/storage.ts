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
      upsert: true
    });

  if (error) throw error;

  // Get public URL
  const { data: { publicUrl } } = supabase.storage
    .from('products')
    .getPublicUrl(data.path);

  return publicUrl;
}

/**
 * Upload an ebook file to the private ebooks bucket
 * @param file File to upload (PDF only)
 * @param productId ID of the product this ebook belongs to
 */
export async function uploadEbookFile(file: File, productId: string) {
  if (file.type !== 'application/pdf') {
    throw new Error('Only PDF files are allowed for e-books');
  }

  const fileExt = 'pdf';
  const fileName = `${productId}_${Date.now()}.${fileExt}`;
  
  const { data, error } = await supabase.storage
    .from('ebooks')
    .upload(fileName, file, {
      cacheControl: '3600',
      upsert: true
    });

  if (error) {
    if (error.message.includes('bucket not found')) {
      throw new Error('E-books storage bucket not initialized. Please contact support.');
    }
    throw error;
  }

  return data.path;
}

/**
 * Upload an image to the settings bucket (logo, etc.)
 */
export async function uploadSiteAsset(file: File, path?: string) {
  const fileExt = file.name.split('.').pop();
  const fileName = `site_${Date.now()}.${fileExt}`;
  const filePath = path ? `${path}/${fileName}` : fileName;

  const { data, error } = await supabase.storage
    .from('products') // Using products bucket as a general asset store for now
    .upload(`assets/${filePath}`, file, {
      cacheControl: '3600',
      upsert: true
    });

  if (error) throw error;

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
