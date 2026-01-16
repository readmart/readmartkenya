import { supabase } from './supabase/client';

interface OptimizeImageOptions {
  width?: number;
  height?: number;
  quality?: number;
  format?: 'webp' | 'origin';
  resize?: 'cover' | 'contain' | 'fill';
}

/**
 * Generates an optimized public URL for images stored in Supabase.
 * Uses Supabase's built-in image transformation engine.
 */
export function getOptimizedImageUrl(
  bucket: string,
  path: string,
  options: OptimizeImageOptions = {}
) {
  const {
    width,
    height,
    quality = 80,
    format = 'webp',
    resize = 'cover'
  } = options;

  const transform: any = {
    quality,
    format,
    resize,
  };

  if (width) transform.width = width;
  if (height) transform.height = height;

  const { data } = supabase.storage
    .from(bucket)
    .getPublicUrl(path, {
      transform,
    });

  return data.publicUrl;
}

/**
 * Predefined optimization presets
 */
export const ImagePresets = {
  THUMBNAIL: { width: 150, height: 150, quality: 70 },
  PRODUCT_CARD: { width: 400, height: 600, quality: 80 },
  BANNER: { width: 1200, height: 400, quality: 85 },
  AVATAR: { width: 100, height: 100, quality: 80 },
};
