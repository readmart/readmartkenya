import { describe, it, expect, vi, beforeEach } from 'vitest';
import { uploadBook, updateBook, getBookVersions, revertBookVersion, extractFileMetadata } from '../books';
import { supabase } from '@/lib/supabase/client';
import * as retryModule from '@/lib/retry';
import JSZip from 'jszip';
import * as mammoth from 'mammoth';
import pdf from 'pdf-parse';

// Mock Supabase
vi.mock('@/lib/supabase/client', () => ({
  supabase: {
    from: vi.fn(),
  }
}));

// Mock API helpers
vi.mock('@/lib/utils/api-helpers', () => ({
  verifyRole: vi.fn().mockResolvedValue({ user: { id: 'test-user-id' } }),
  logAudit: vi.fn().mockResolvedValue(null)
}));

// Mock storage
vi.mock('../storage', () => ({
  uploadEbookFile: vi.fn().mockResolvedValue('https://example.com/ebook.pdf'),
  uploadProductImage: vi.fn().mockResolvedValue('https://example.com/image.jpg')
}));

// Mock retry module
vi.mock('@/lib/retry', () => ({
  withRetry: vi.fn((fn) => fn()),
}));

// Mock jszip, mammoth, pdf-parse
const mockZipFile = vi.fn();
const mockZipLoadAsync = vi.fn().mockReturnThis();

vi.mock('jszip', () => {
  return {
    default: class {
      loadAsync = mockZipLoadAsync;
      file = mockZipFile;
    }
  };
});
vi.mock('mammoth', () => ({
  extractRawText: vi.fn()
}));
vi.mock('pdf-parse', () => ({
  __esModule: true,
  default: vi.fn()
}));

// Helper to create a mock file with arrayBuffer
const createMockFile = (name: string, type: string, content: string = '') => {
  const file = new File([content], name, { type });
  // Polyfill arrayBuffer for Node environment if missing
  Object.defineProperty(file, 'arrayBuffer', {
    value: async () => {
      const buffer = Buffer.from(content);
      return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;
    }
  });
  return file;
};

const createMockChain = (finalResult: any = { data: null, error: null }) => {
  const chain: any = {
    insert: vi.fn(() => chain),
    update: vi.fn(() => chain),
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    order: vi.fn(() => chain),
    single: vi.fn(() => Promise.resolve(finalResult)),
  };
  return chain;
};

describe('Book System API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockZipLoadAsync.mockReturnThis();
  });

  describe('extractFileMetadata', () => {
    it('should extract metadata from PDF', async () => {
      const file = createMockFile('test.pdf', 'application/pdf', 'mock pdf content');
      (pdf as any).mockResolvedValue({
        numpages: 10,
        info: { Title: 'PDF Title', Author: 'PDF Author' },
        text: 'PDF Text Content'
      });

      const metadata = await extractFileMetadata(file);

      expect(metadata.format).toBe('pdf');
      expect(metadata.page_count).toBe(10);
      expect(metadata.extracted_title).toBe('PDF Title');
      expect(metadata.extracted_author).toBe('PDF Author');
      expect(metadata.description).toBe('PDF Text Content');
    });

    it('should extract metadata from EPUB', async () => {
      const file = createMockFile('test.epub', 'application/epub+zip');
      mockZipFile.mockImplementation((path: string) => {
        if (path === 'META-INF/container.xml') {
          return { async: vi.fn().mockResolvedValue('<container><rootfiles><rootfile full-path="content.opf"/></rootfiles></container>') };
        }
        if (path === 'content.opf') {
          return { async: vi.fn().mockResolvedValue('<package><metadata><dc:title>EPUB Title</dc:title><dc:creator>EPUB Author</dc:creator><dc:description>EPUB Description</dc:description></metadata></package>') };
        }
        return null;
      });

      const metadata = await extractFileMetadata(file);

      expect(metadata.format).toBe('epub');
      expect(metadata.extracted_title).toBe('EPUB Title');
      expect(metadata.extracted_author).toBe('EPUB Author');
      expect(metadata.description).toBe('EPUB Description');
    });

    it('should extract metadata from DOCX', async () => {
      const file = createMockFile('test.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      mockZipFile.mockImplementation((path: string) => {
        if (path === 'docProps/core.xml') {
          return { async: vi.fn().mockResolvedValue('<cp:coreProperties><dc:title>DOCX Title</dc:title><dc:creator>DOCX Author</dc:creator></cp:coreProperties>') };
        }
        return null;
      });
      (mammoth.extractRawText as any).mockResolvedValue({ value: 'DOCX Text Content' });

      const metadata = await extractFileMetadata(file);

      expect(metadata.format).toBe('docx');
      expect(metadata.extracted_title).toBe('DOCX Title');
      expect(metadata.extracted_author).toBe('DOCX Author');
      expect(metadata.description).toBe('DOCX Text Content');
    });
  });

  describe('uploadBook', () => {
    it('should upload a book and create initial version', async () => {
      const bookData = {
        title: 'New Book',
        author: 'Author Name',
        price: 29.99,
        category_id: 'cat-123',
        type: 'ebook' as const,
        bookFile: createMockFile('book.pdf', 'application/pdf', 'mock content'),
        coverImage: createMockFile('cover.jpg', 'image/jpeg', 'mock image')
      };

      const mockProduct = { id: 'prod-123', ...bookData };
      const mockChain = createMockChain({ data: mockProduct, error: null });
      (supabase.from as any).mockReturnValue(mockChain);

      const result = await uploadBook(bookData);

      expect(result).toEqual(mockProduct);
      expect(mockChain.insert).toHaveBeenCalledWith(expect.arrayContaining([
        expect.objectContaining({ title: 'New Book', current_version: 1 })
      ]));
      // Check version record creation
      expect(supabase.from).toHaveBeenCalledWith('product_versions');
      expect(mockChain.insert).toHaveBeenCalledWith(expect.arrayContaining([
        expect.objectContaining({ version_number: 1, product_id: 'prod-123' })
      ]));
    });
  });

  describe('updateBook', () => {
    it('should create a new version before updating', async () => {
      const productId = 'prod-123';
      const updates = { price: 39.99 };
      const currentProduct = { id: productId, title: 'Old Title', price: 29.99, current_version: 1 };
      
      const mockChain = createMockChain({ data: currentProduct, error: null });
      (supabase.from as any).mockReturnValue(mockChain);

      const result = await updateBook(productId, updates, 'Price increase');

      expect(mockChain.update).toHaveBeenCalledWith(expect.objectContaining({
        price: 39.99,
        current_version: 2
      }));
      // Check that version 1 was saved as a snapshot
      expect(mockChain.insert).toHaveBeenCalledWith(expect.arrayContaining([
        expect.objectContaining({ version_number: 1, product_id: productId, change_reason: 'Price increase' })
      ]));
    });
  });

  describe('revertBookVersion', () => {
    it('should revert to a previous version', async () => {
      const productId = 'prod-123';
      const versionId = 'ver-456';
      const versionSnapshot = { title: 'Old Title', price: 25.00, current_version: 5 };
      const mockVersion = { id: versionId, version_number: 5, snapshot: versionSnapshot };
      
      const mockChain = createMockChain({ data: mockVersion, error: null });
      (supabase.from as any).mockReturnValue(mockChain);

      // We need to mock the updateBook call inside revertBookVersion
      // Since updateBook is in the same file, we can't easily mock it if we import it directly
      // But we can check if the underlying supabase calls happen
      
      await revertBookVersion(productId, versionId);

      // Should fetch the version
      expect(supabase.from).toHaveBeenCalledWith('product_versions');
      expect(mockChain.eq).toHaveBeenCalledWith('id', versionId);
      
      // Should then call updateBook logic (which calls products update)
      expect(supabase.from).toHaveBeenCalledWith('products');
      expect(mockChain.update).toHaveBeenCalledWith(expect.objectContaining({
        title: 'Old Title',
        price: 25.00
      }));
    });
  });
});
