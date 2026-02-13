import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getGlobalAnalytics } from '../dashboards';
import { supabase } from '@/lib/supabase/client';

// Mock Supabase
vi.mock('@/lib/supabase/client', () => ({
  supabase: {
    from: vi.fn(),
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session: { user: { id: 'test-admin-id' } } },
        error: null
      })
    }
  }
}));

// Mock api-helpers
vi.mock('@/lib/utils/api-helpers', () => ({
  verifyAdmin: vi.fn().mockResolvedValue({ user: { id: 'test-admin-id' } }),
  calculateTrend: vi.fn((curr, prev) => {
    if (prev === 0) return curr > 0 ? '+100%' : '0%';
    const diff = ((curr - prev) / prev) * 100;
    return `${diff >= 0 ? '+' : ''}${diff.toFixed(1)}%`;
  }),
  logAudit: vi.fn().mockResolvedValue(null)
}));

function createSupabaseMock(dataMap: Record<string, any>) {
  const queryBuilder: any = {
    select: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    lt: vi.fn().mockReturnThis(),
    filter: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    single: vi.fn().mockReturnThis(),
    then: vi.fn().mockImplementation((resolve) => {
      // Find the current table being queried
      // This is a bit hacky but vitest mocks can be tricky with chained calls
      const table = (supabase.from as any).mock.calls[(supabase.from as any).mock.calls.length - 1][0];
      resolve(dataMap[table] || { data: [], error: null });
    }),
    catch: vi.fn().mockReturnThis()
  };

  queryBuilder.select = vi.fn().mockImplementation((_query, options) => {
    if (options?.count === 'exact') {
      const table = (supabase.from as any).mock.calls[(supabase.from as any).mock.calls.length - 1][0];
      return {
        then: (resolve: any) => resolve(dataMap[`${table}_count`] || { count: 0, error: null }),
        catch: vi.fn().mockReturnThis()
      };
    }
    return queryBuilder;
  });

  return queryBuilder;
}

describe('Analytics Engine Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should accurately aggregate revenue and calculate trends from real data', async () => {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 15);
    const fortyFiveDaysAgo = new Date();
    fortyFiveDaysAgo.setDate(fortyFiveDaysAgo.getDate() - 45);

    const mockOrders = [
      { id: 'o1', created_at: thirtyDaysAgo.toISOString(), is_paid: true, total_amount: 1000, status: 'completed' },
      { id: 'o2', created_at: fortyFiveDaysAgo.toISOString(), is_paid: true, total_amount: 500, status: 'completed' }
    ];

    const dataMap = {
      orders: { data: mockOrders, error: null },
      transactions: { data: [], error: null },
      profiles_count: { count: 10, error: null },
      products_count: { count: 20, error: null },
      profiles: { data: [], error: null },
      products: { data: [], error: null },
      order_items: { data: [], error: null },
      book_club_members_count: { count: 5, error: null },
      book_club_members: { count: 5, error: null }
    };

    (supabase.from as any).mockImplementation(() => createSupabaseMock(dataMap));

    const result = await getGlobalAnalytics();

    expect(result.totalRevenue).toBe(1000);
    expect(result.revenueTrend).toBe('+100.0%');
    expect(result.totalOrders).toBe(1);
  });

  it('should handle category saturation calculation from real order items', async () => {
    const mockOrderItems = [
      {
        quantity: 2,
        price_at_purchase: 500,
        product_snapshot: { category: { name: 'Fiction' }, title: 'Book A' },
        orders: { is_paid: true, status: 'completed' }
      },
      {
        quantity: 1,
        price_at_purchase: 1000,
        product_snapshot: { category: { name: 'Non-Fiction' }, title: 'Book B' },
        orders: { is_paid: true, status: 'completed' }
      }
    ];

    const dataMap = {
      orders: { data: [], error: null },
      transactions: { data: [], error: null },
      profiles_count: { count: 10, error: null },
      products_count: { count: 20, error: null },
      profiles: { data: [], error: null },
      products: { data: [], error: null },
      order_items: { data: mockOrderItems, error: null },
      book_club_members_count: { count: 5, error: null },
      book_club_members: { count: 5, error: null }
    };

    (supabase.from as any).mockImplementation(() => createSupabaseMock(dataMap));

    const result = await getGlobalAnalytics();

    expect(result.categoryStats).toContainEqual({ name: 'Fiction', value: 1000 });
    expect(result.categoryStats).toContainEqual({ name: 'Non-Fiction', value: 1000 });
  });

  it('should correctly filter out unpaid or cancelled orders from analytics', async () => {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 5);

    const mockOrders = [
      { id: 'o1', created_at: thirtyDaysAgo.toISOString(), is_paid: true, total_amount: 1000, status: 'completed' },
      { id: 'o2', created_at: thirtyDaysAgo.toISOString(), is_paid: false, total_amount: 500, status: 'pending' },
      { id: 'o3', created_at: thirtyDaysAgo.toISOString(), is_paid: true, total_amount: 2000, status: 'cancelled' }
    ];

    const dataMap = {
      orders: { data: mockOrders, error: null },
      transactions: { data: [], error: null },
      profiles_count: { count: 10, error: null },
      products_count: { count: 20, error: null },
      profiles: { data: [], error: null },
      products: { data: [], error: null },
      order_items: { data: [], error: null },
      book_club_members_count: { count: 5, error: null },
      book_club_members: { count: 5, error: null }
    };

    (supabase.from as any).mockImplementation(() => createSupabaseMock(dataMap));

    const result = await getGlobalAnalytics();

    expect(result.totalOrders).toBe(1);
    expect(result.totalRevenue).toBe(1000);
  });
});
