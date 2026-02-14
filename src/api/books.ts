import { supabase } from '@/lib/supabase/client';
import { withRetry } from '@/lib/retry';
import { verifyRole, logAudit } from '@/lib/utils/api-helpers';
import { uploadEbookFile, uploadProductImage } from './storage';

import JSZip from 'jszip';
import * as mammoth from 'mammoth';
import pdf from 'pdf-parse';

export interface BookMetadata {
  format: string;
  size_bytes: number;
  page_count?: number;
  extracted_title?: string;
  extracted_author?: string;
  description?: string;
}

/**
 * Extract basic metadata from a file
 */
export async function extractFileMetadata(file: File): Promise<BookMetadata> {
  const extension = file.name.split('.').pop()?.toLowerCase() || 'unknown';
  const metadata: BookMetadata = {
    format: extension,
    size_bytes: file.size,
    extracted_title: file.name.replace(/\.[^/.]+$/, "").replace(/[_-]/g, ' ')
  };

  try {
    if (extension === 'docx') {
      try {
        const zip = new JSZip();
        const content = await zip.loadAsync(file);
        
        // Extract metadata from docProps/core.xml
        const coreXml = await content.file("docProps/core.xml")?.async("string");
        if (coreXml) {
          metadata.extracted_title = coreXml.match(/<dc:title[^>]*>([^<]+)<\/dc:title>/)?.[1] || metadata.extracted_title;
          metadata.extracted_author = coreXml.match(/<dc:creator[^>]*>([^<]+)<\/dc:creator>/)?.[1] || 
                                     coreXml.match(/<cp:lastModifiedBy[^>]*>([^<]+)<\/cp:lastModifiedBy>/)?.[1];
        }

        // Extract description/preview using mammoth
        try {
          const arrayBuffer = await file.arrayBuffer();
          const result = await mammoth.extractRawText({ arrayBuffer });
          metadata.description = result.value.substring(0, 500);
        } catch (mammothError) {
          console.warn('Mammoth extraction failed:', mammothError);
        }
      } catch (docxError) {
        console.warn('DOCX metadata extraction failed:', docxError);
      }
    } else if (extension === 'epub') {
      try {
        const zip = new JSZip();
        const content = await zip.loadAsync(file);
        
        // Try to find the OPF file to get real metadata
        const containerXml = await content.file("META-INF/container.xml")?.async("string");
        if (containerXml) {
          const fullPathMatch = containerXml.match(/full-path="([^"]+)"/);
          if (fullPathMatch) {
            const opfPath = fullPathMatch[1];
            const opfContent = await content.file(opfPath)?.async("string");
            if (opfContent) {
              // More robust regex for EPUB metadata
              const titleMatch = opfContent.match(/<dc:title[^>]*>([^<]+)<\/dc:title>/i);
              const authorMatch = opfContent.match(/<dc:creator[^>]*>([^<]+)<\/dc:creator>/i);
              const descMatch = opfContent.match(/<dc:description[^>]*>([^<]+)<\/dc:description>/i);
              
              if (titleMatch) metadata.extracted_title = titleMatch[1].trim();
              if (authorMatch) metadata.extracted_author = authorMatch[1].trim();
              if (descMatch) metadata.description = descMatch[1].trim().substring(0, 500);
            }
          }
        }
      } catch (epubError) {
        console.warn('EPUB metadata extraction failed:', epubError);
      }
    } else if (extension === 'pdf') {
      try {
        const arrayBuffer = await file.arrayBuffer();
        if (arrayBuffer.byteLength > 0) {
          const buffer = Buffer.from(arrayBuffer);
          const data = await pdf(buffer);
          
          metadata.page_count = data.numpages;
          metadata.extracted_title = data.info?.Title || metadata.extracted_title;
          metadata.extracted_author = data.info?.Author;
          metadata.description = data.text.substring(0, 500);
        }
      } catch (pdfError) {
        console.warn('PDF parsing failed:', pdfError);
      }
    }
  } catch (error) {
    console.warn('Metadata extraction failed, falling back to basic info:', error);
  }

  return metadata;
}

/**
 * Create a new book with upload and metadata
 */
export async function uploadBook(data: {
  title: string;
  author?: string;
  description?: string;
  price: number;
  category_id: string;
  type: 'ebook' | 'physical';
  bookFile?: File;
  coverImage?: File;
}) {
  await verifyRole(['admin', 'founder', 'author']);

  // Security: Basic file validation
  if (data.type === 'ebook' && data.bookFile) {
    const MAX_SIZE = 50 * 1024 * 1024; // 50MB
    if (data.bookFile.size > MAX_SIZE) {
      throw new Error('Ebook file too large. Max size is 50MB.');
    }
    
    const allowedExtensions = ['pdf', 'epub', 'docx'];
    const ext = data.bookFile.name.split('.').pop()?.toLowerCase();
    if (!ext || !allowedExtensions.includes(ext)) {
      throw new Error('Invalid file format. Only PDF, EPUB, and DOCX are supported.');
    }
  }

  if (data.coverImage) {
    const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB
    if (data.coverImage.size > MAX_IMAGE_SIZE) {
      throw new Error('Cover image too large. Max size is 5MB.');
    }
  }

  let ebook_url = '';
  let image_url = '';
  let extractedMetadata: BookMetadata | null = null;

  // 1. Upload file if it's an ebook
  if (data.type === 'ebook' && data.bookFile) {
    extractedMetadata = await extractFileMetadata(data.bookFile);
    const identifier = data.title.toLowerCase().replace(/[^a-z0-9]/g, '-');
    ebook_url = await uploadEbookFile(data.bookFile, identifier);
  }

  // 2. Upload cover image if provided
  if (data.coverImage) {
    image_url = await uploadProductImage(data.coverImage);
  }

  // 3. Create product record
  const productPayload = {
    name: data.title, // Map title to name for compatibility
    title: data.title,
    author: data.author || extractedMetadata?.extracted_author,
    description: data.description || extractedMetadata?.description,
    price: data.price,
    category_id: data.category_id,
    type: data.type,
    ebook_url: ebook_url || null,
    image_url: image_url || null,
    is_ebook: data.type === 'ebook',
    is_active: true,
    current_version: 1,
    slug: data.title.toLowerCase().replace(/[^a-z0-9]/g, '-') + '-' + Math.random().toString(36).substring(2, 7)
  };

  return withRetry(async () => {
    const { data: product, error } = await supabase
      .from('products')
      .insert([productPayload])
      .select()
      .single();

    if (error) throw error;

    // 4. Save ebook metadata if applicable
    if (product && extractedMetadata) {
      await supabase.from('ebook_metadata').insert([{
        product_id: product.id,
        file_path: ebook_url,
        format: extractedMetadata.format,
        file_size_bytes: extractedMetadata.size_bytes,
        page_count: extractedMetadata.page_count
      }]);
    }

    await logAudit('CREATE_BOOK', 'products', product.id, productPayload);
    
    // 5. Initial version record
    await supabase.from('product_versions').insert([{
      product_id: product.id,
      version_number: 1,
      snapshot: product,
      change_reason: 'Initial upload'
    }]);

    return product;
  });
}

/**
 * Update a book with version control
 */
export async function updateBook(id: string, updates: any, changeReason: string = 'Update') {
  await verifyRole(['admin', 'founder', 'author']);

  return withRetry(async () => {
    // 1. Get current data for snapshot
    const { data: currentProduct, error: fetchError } = await supabase
      .from('products')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError) throw fetchError;

    // 2. Create version record from current data before update
    const nextVersion = (currentProduct.current_version || 1) + 1;
    
    await supabase.from('product_versions').insert([{
      product_id: id,
      version_number: currentProduct.current_version || 1,
      snapshot: currentProduct,
      change_reason: changeReason
    }]);

    // 3. Apply updates
    const { data: updatedProduct, error: updateError } = await supabase
      .from('products')
      .update({
        ...updates,
        current_version: nextVersion,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (updateError) throw updateError;

    await logAudit('UPDATE_BOOK', 'products', id, updates, currentProduct);

    return updatedProduct;
  });
}

/**
 * Get version history for a book
 */
export async function getBookVersions(productId: string) {
  await verifyRole(['admin', 'founder', 'author']);
  
  const { data, error } = await supabase
    .from('product_versions')
    .select('*')
    .eq('product_id', productId)
    .order('version_number', { ascending: false });

  if (error) throw error;
  return data;
}

/**
 * Revert to a specific version
 */
export async function revertBookVersion(productId: string, versionId: string) {
  await verifyRole(['admin', 'founder']);

  const { data: version, error: vError } = await supabase
    .from('product_versions')
    .select('*')
    .eq('id', versionId)
    .single();

  if (vError) throw vError;

  return updateBook(productId, version.snapshot, `Reverted to version ${version.version_number}`);
}
