import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createProduct, updateProduct } from '../dashboards';
import { supabase } from '@/lib/supabase/client';
import * as retryModule from '@/lib/retry';

// Helper to create a mock chain
const createMockChain = (finalResult: any = { data: null, error: null }) => {
  const chain: any = {
    insert: vi.fn(() => chain),
    update: vi.fn(() => chain),
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    maybeSingle: vi.fn(() => Promise.resolve(finalResult)),
    single: vi.fn(() => Promise.resolve(finalResult)),
    upsert: vi.fn(() => chain),
  };
  return chain;
};

// Mock Supabase
vi.mock('@/lib/supabase/client', () => ({
  supabase: {
    from: vi.fn(),
  }
}));

// Mock API helpers
vi.mock('@/lib/utils/api-helpers', () => ({
  verifyAdmin: vi.fn().mockResolvedValue({ user: { id: 'test-user-id' } }),
  verifyAuthor: vi.fn().mockResolvedValue({ user: { id: 'test-user-id' } }),
  logAudit: vi.fn().mockResolvedValue(null)
}));

// Mock retry module
vi.mock('@/lib/retry', () => ({
  withRetry: vi.fn((fn) => fn()),
}));

describe('Product Upload Resilience Verification', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset withRetry to default behavior for most tests
    (retryModule.withRetry as any).mockImplementation((fn: any) => fn());
  });

  describe('createProduct', () => {
    it('should handle missing columns (PGRST204) by filtering and retrying', async () => {
      const product = {
        title: 'Test Book',
        author_id: 'auth-123',
        description: 'A great book',
        price: 100
      };

      // Mock first call failing with PGRST204 for author_id
      const errorResponse = {
        error: {
          code: 'PGRST204',
          message: "Could not find the 'author_id' column of 'products' in the schema cache"
        },
        data: null
      };

      const successResponse = {
        data: { id: 'prod-123', title: 'Test Book', slug: 'test-book-abc' },
        error: null
      };

      // Mock withRetry to actually retry once without delay
      (retryModule.withRetry as any).mockImplementation(async (fn: any) => {
        try {
          return await fn();
        } catch (e) {
          return await fn();
        }
      });

      const mockChain = createMockChain();
      mockChain.maybeSingle
        .mockResolvedValueOnce(errorResponse)
        .mockResolvedValueOnce(successResponse);
      
      (supabase.from as any).mockReturnValue(mockChain);

      const result = await createProduct({ ...product });

      expect(result).toEqual(successResponse.data);
      expect(mockChain.insert).toHaveBeenCalledTimes(2);
      
      // First attempt included author_id (now correctly set from mocked session)
      const firstCallPayload = mockChain.insert.mock.calls[0][0][0];
      expect(firstCallPayload).toHaveProperty('author_id');
      
      // Second attempt (retry) should have filtered out author_id
      const secondCallPayload = mockChain.insert.mock.calls[1][0][0];
      expect(secondCallPayload).not.toHaveProperty('author_id');
    });

    it('should handle explicit description processing', async () => {
      const product = {
        title: 'Empty Desc Book',
        description: '   ', // Should become null
        price: 100
      };

      const successResponse = {
        data: { id: 'prod-124', title: 'Empty Desc Book', slug: 'empty-desc' },
        error: null
      };

      const mockChain = createMockChain(successResponse);
      (supabase.from as any).mockReturnValue(mockChain);

      await createProduct(product);

      expect(mockChain.insert.mock.calls[0][0][0].description).toBe(null);
    });
  });

  describe('updateProduct', () => {
    it('should handle missing columns in update', async () => {
      const product = {
        title: 'Updated Title',
        author_id: 'auth-123'
      };

      const errorResponse = {
        error: {
          code: 'PGRST204',
          message: "column 'author_id' does not exist"
        },
        data: null
      };

      const successResponse = {
        data: { id: 'prod-123', title: 'Updated Title', slug: 'updated-title' },
        error: null
      };

      // Mock withRetry to actually retry once without delay
      (retryModule.withRetry as any).mockImplementation(async (fn: any) => {
        try {
          return await fn();
        } catch (e) {
          return await fn();
        }
      });

      const mockChain = createMockChain();
      mockChain.maybeSingle
        .mockResolvedValueOnce(successResponse) // For oldData fetch
        .mockResolvedValueOnce(errorResponse)   // First update attempt
        .mockResolvedValueOnce(successResponse); // Second update attempt
      
      (supabase.from as any).mockReturnValue(mockChain);

      const result = await updateProduct('prod-123', { ...product });

      expect(result).toEqual(successResponse.data);
      expect(mockChain.update).toHaveBeenCalledTimes(2);
      expect(mockChain.update.mock.calls[1][0]).not.toHaveProperty('author_id');
    });
  });
});
