import { describe, it, expect, vi, beforeEach } from 'vitest';
import { uploadBook } from '../books';
import { supabase } from '@/lib/supabase/client';

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

// Mock metadata extraction
vi.mock('../books', async (importOriginal) => {
  const actual = await importOriginal() as any;
  return {
    ...actual,
    extractFileMetadata: vi.fn().mockImplementation(async (file: File) => {
      return {
        format: file.name.split('.').pop() || 'pdf',
        size_bytes: file.size,
        extracted_title: 'Mock Title'
      };
    })
  };
});

const createMockFile = (name: string, size: number, type: string) => {
  const file = new File([''], name, { type });
  Object.defineProperty(file, 'size', { value: size });
  // Polyfill arrayBuffer for Node environment if missing
  Object.defineProperty(file, 'arrayBuffer', {
    value: async () => new ArrayBuffer(0)
  });
  return file;
};

describe('Book Upload Security', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should reject ebook files larger than 50MB', async () => {
    const largeFile = createMockFile('large.pdf', 51 * 1024 * 1024, 'application/pdf');
    const bookData = {
      title: 'Large Book',
      price: 10,
      category_id: 'cat-1',
      type: 'ebook' as const,
      bookFile: largeFile
    };

    await expect(uploadBook(bookData)).rejects.toThrow('Ebook file too large. Max size is 50MB.');
  });

  it('should reject invalid ebook file formats', async () => {
    const invalidFile = createMockFile('malicious.exe', 1024, 'application/x-msdownload');
    const bookData = {
      title: 'Invalid Book',
      price: 10,
      category_id: 'cat-1',
      type: 'ebook' as const,
      bookFile: invalidFile
    };

    await expect(uploadBook(bookData)).rejects.toThrow('Invalid file format. Only PDF, EPUB, and DOCX are supported.');
  });

  it('should reject cover images larger than 5MB', async () => {
    const largeImage = createMockFile('large.jpg', 6 * 1024 * 1024, 'image/jpeg');
    const bookData = {
      title: 'Large Image Book',
      price: 10,
      category_id: 'cat-1',
      type: 'physical' as const,
      coverImage: largeImage
    };

    await expect(uploadBook(bookData)).rejects.toThrow('Cover image too large. Max size is 5MB.');
  });

  it('should accept valid ebook and cover image', async () => {
    const validFile = createMockFile('book.pdf', 10 * 1024 * 1024, 'application/pdf');
    const validImage = createMockFile('cover.jpg', 1 * 1024 * 1024, 'image/jpeg');
    const bookData = {
      title: 'Valid Book',
      price: 10,
      category_id: 'cat-1',
      type: 'ebook' as const,
      bookFile: validFile,
      coverImage: validImage
    };

    // Mock successful database insert
    const mockChain: any = {
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { id: 'prod-1' }, error: null })
    };
    (supabase.from as any).mockReturnValue(mockChain);

    await expect(uploadBook(bookData)).resolves.not.toThrow();
  });
});
