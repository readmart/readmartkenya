import { supabase } from '@/lib/supabase/client';
import { withRetry } from '@/lib/retry';

/**
 * Common upload options
 */
export interface UploadOptions {
  path?: string;
  onProgress?: (progress: { loaded: number; total: number }) => void;
  maxSizeMB?: number;
  allowedTypes?: string[];
  useTus?: boolean;
}

/**
 * Validate file before upload
 */
function validateFile(file: File, options: UploadOptions) {
  if (options.maxSizeMB && file.size > options.maxSizeMB * 1024 * 1024) {
    throw new Error(`File size exceeds the maximum limit of ${options.maxSizeMB}MB`);
  }
  if (options.allowedTypes && !options.allowedTypes.includes(file.type)) {
    throw new Error(`Invalid file type. Allowed types: ${options.allowedTypes.join(', ')}`);
  }
}

/**
 * Upload an image to the products bucket
 */
export async function uploadProductImage(file: File, options: UploadOptions = {}) {
  validateFile(file, { 
    maxSizeMB: options.maxSizeMB || 5, 
    allowedTypes: options.allowedTypes || ['image/jpeg', 'image/png', 'image/webp'] 
  });

  const fileExt = file.name.split('.').pop();
  const fileName = `${Math.random().toString(36).substring(2)}_${Date.now()}.${fileExt}`;
  const filePath = options.path ? `${options.path}/${fileName}` : fileName;

  return withRetry(async () => {
    const { data, error } = await supabase.storage
      .from('products')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: true,
        onUploadProgress: options.onProgress
      });

    if (error) throw error;

    const { data: { publicUrl } } = supabase.storage
      .from('products')
      .getPublicUrl(data.path);

    return publicUrl;
  }, { retries: 2 });
}

/**
 * Upload an ebook file to the private ebooks bucket
 */
export async function uploadEbookFile(file: File, identifier: string, options: UploadOptions = {}) {
  validateFile(file, { 
    maxSizeMB: options.maxSizeMB || 100, // 100MB default for ebooks
    allowedTypes: ['application/pdf', 'application/epub+zip'] 
  });

  const fileExt = file.name.split('.').pop() || 'pdf';
  const fileName = `${identifier}_${Date.now()}.${fileExt}`;
  
  // Use TUS for files larger than 6MB for better reliability and chunking
  const useTus = options.useTus || file.size > 6 * 1024 * 1024;
  
  console.log(`[Storage] Starting ${useTus ? 'TUS ' : ''}upload for ${file.name} (${(file.size / 1024 / 1024).toFixed(2)}MB) to ebooks bucket`);

  return withRetry(async () => {
    const { data, error } = await supabase.storage
      .from('ebooks')
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: true,
        // @ts-ignore - Some versions of the client might not have this in types but it's supported
        useTus: useTus,
        duplex: 'half',
        contentType: file.type,
        onUploadProgress: (progress) => {
          if (options.onProgress) {
            options.onProgress(progress);
          }
        }
      });

    if (error) {
      if (error.message.includes('bucket not found')) {
        throw new Error('E-books storage bucket not initialized. Please contact support.');
      }
      throw error;
    }

    return data.path;
  }, { retries: 2 });
}

/**
 * Upload a partnership agreement
 */
export async function uploadAgreementFile(file: File, identifier: string, bucket: 'agreements' | 'signed_agreements' = 'agreements', options: UploadOptions = {}) {
  validateFile(file, { 
    maxSizeMB: options.maxSizeMB || 10, 
    allowedTypes: ['application/pdf'] 
  });

  const fileName = `${bucket === 'signed_agreements' ? 'signed_' : 'template_'}${identifier}_${Date.now()}.pdf`;
  
  return withRetry(async () => {
    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: true,
        onUploadProgress: options.onProgress
      });

    if (error) {
      if (error.message.includes('bucket not found')) {
        throw new Error(`${bucket} storage bucket not initialized.`);
      }
      throw error;
    }

    return data.path;
  }, { retries: 2 });
}

/**
 * Upload an image to the site_assets bucket
 */
export async function uploadSiteAsset(file: File, options: UploadOptions = {}) {
  validateFile(file, { 
    maxSizeMB: options.maxSizeMB || 2, 
    allowedTypes: ['image/jpeg', 'image/png', 'image/svg+xml', 'image/x-icon', 'image/webp'] 
  });

  const fileExt = file.name.split('.').pop();
  const fileName = `site_${Date.now()}.${fileExt}`;
  const filePath = options.path ? `${options.path}/${fileName}` : fileName;

  return withRetry(async () => {
    const { data, error } = await supabase.storage
      .from('site_assets')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: true,
        onUploadProgress: options.onProgress
      });

    if (error) throw error;

    const { data: { publicUrl } } = supabase.storage
      .from('site_assets')
      .getPublicUrl(data.path);

    return publicUrl;
  }, { retries: 2 });
}

/**
 * Upload an image to the banners bucket
 */
export async function uploadBannerImage(file: File, options: UploadOptions = {}) {
  validateFile(file, { 
    maxSizeMB: options.maxSizeMB || 5, 
    allowedTypes: options.allowedTypes || ['image/jpeg', 'image/png', 'image/webp'] 
  });

  const fileExt = file.name.split('.').pop();
  const fileName = `banner_${Date.now()}.${fileExt}`;
  const filePath = options.path ? `${options.path}/${fileName}` : fileName;

  return withRetry(async () => {
    const { data, error } = await supabase.storage
      .from('banners')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: true,
        onUploadProgress: options.onProgress
      });

    if (error) throw error;

    const { data: { publicUrl } } = supabase.storage
      .from('banners')
      .getPublicUrl(data.path);

    return publicUrl;
  }, { retries: 2 });
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
 * Upload qualification proof
 */
export async function uploadQualificationProof(file: File, userId: string, options: UploadOptions = {}) {
  validateFile(file, { 
    maxSizeMB: options.maxSizeMB || 10,
    allowedTypes: ['application/pdf', 'image/jpeg', 'image/png']
  });

  const fileExt = file.name.split('.').pop();
  const fileName = `proof_${userId}_${Date.now()}.${fileExt}`;
  
  return withRetry(async () => {
    const { data, error } = await supabase.storage
      .from('partnership_documents')
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: true,
        onUploadProgress: options.onProgress
      });

    if (error) {
      if (error.message.includes('bucket not found')) {
        throw new Error('Storage bucket for documents not found. Please contact support.');
      }
      throw error;
    }

    return data.path;
  }, { retries: 2 });
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
