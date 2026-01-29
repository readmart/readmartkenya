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
 * @param identifier Unique identifier (e.g., productId or temp name)
 */
export async function uploadEbookFile(file: File, identifier: string) {
  if (file.type !== 'application/pdf') {
    throw new Error('Only PDF files are allowed for e-books');
  }

  const fileName = `${identifier}_${Date.now()}.pdf`;
  
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
 * Upload a partnership agreement (template or signed)
 * @param file File to upload (PDF only)
 * @param identifier Unique identifier
 * @param bucket Bucket to upload to (defaults to agreements)
 */
export async function uploadAgreementFile(file: File, identifier: string, bucket: 'agreements' | 'signed_agreements' = 'agreements') {
  if (file.type !== 'application/pdf') {
    throw new Error('Only PDF files are allowed for agreements');
  }

  const fileName = `${bucket === 'signed_agreements' ? 'signed_' : 'template_'}${identifier}_${Date.now()}.pdf`;
  
  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(fileName, file, {
      cacheControl: '3600',
      upsert: true
    });

  if (error) {
    if (error.message.includes('bucket not found')) {
      throw new Error(`${bucket} storage bucket not initialized.`);
    }
    throw error;
  }

  return data.path;
}

/**
 * Upload an image to the site_assets bucket (logo, etc.)
 */
export async function uploadSiteAsset(file: File, path?: string) {
  const fileExt = file.name.split('.').pop();
  const fileName = `site_${Date.now()}.${fileExt}`;
  const filePath = path ? `${path}/${fileName}` : fileName;

  const { data, error } = await supabase.storage
    .from('site_assets')
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: true
    });

  if (error) throw error;

  const { data: { publicUrl } } = supabase.storage
    .from('site_assets')
    .getPublicUrl(data.path);

  return publicUrl;
}

/**
 * Upload an image to the banners bucket
 */
export async function uploadBannerImage(file: File, path?: string) {
  const fileExt = file.name.split('.').pop();
  const fileName = `banner_${Date.now()}.${fileExt}`;
  const filePath = path ? `${path}/${fileName}` : fileName;

  const { data, error } = await supabase.storage
    .from('banners')
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: true
    });

  if (error) throw error;

  const { data: { publicUrl } } = supabase.storage
    .from('banners')
    .getPublicUrl(data.path);

  return publicUrl;
}

/**
 * Upload a signed agreement to the signed_agreements bucket
 */
export async function uploadSignedAgreement(file: File, userId: string) {
  const fileExt = file.name.split('.').pop();
  const fileName = `${userId}_${Date.now()}.${fileExt}`;
  
  const { data, error } = await supabase.storage
    .from('signed_agreements')
    .upload(fileName, file, {
      cacheControl: '3600',
      upsert: true
    });

  if (error) {
    if (error.message.includes('bucket not found')) {
      throw new Error('Storage bucket for signed agreements not found. Please contact support.');
    }
    throw error;
  }

  // Agreements should be private, so we return the path instead of public URL
  return data.path;
}

/**
 * Upload qualification proof for author/partner applications
 */
export async function uploadQualificationProof(file: File, userId: string) {
  const fileExt = file.name.split('.').pop();
  const fileName = `proof_${userId}_${Date.now()}.${fileExt}`;
  
  const { data, error } = await supabase.storage
    .from('partnership_documents')
    .upload(fileName, file, {
      cacheControl: '3600',
      upsert: true
    });

  if (error) {
    if (error.message.includes('bucket not found')) {
      throw new Error('Storage bucket for documents not found. Please contact support.');
    }
    throw error;
  }

  return data.path;
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

/**
 * Delete an ebook file from the private ebooks bucket
 * @param path Path in the ebooks bucket
 */
export async function deleteEbookFile(path: string) {
  try {
    if (!path) return;

    const { error } = await supabase.storage
      .from('ebooks')
      .remove([path]);

    if (error) throw error;
  } catch (error) {
    console.error('Failed to delete ebook file:', error);
  }
}
