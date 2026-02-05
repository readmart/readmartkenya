import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getPartnershipServices } from '../dashboards';
import { supabase } from '@/lib/supabase/client';

// Mock Supabase
vi.mock('@/lib/supabase/client', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          order: vi.fn(() => Promise.resolve({ data: [], error: null }))
        }))
      }))
    }))
  }
}));

describe('getPartnershipServices', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch active partnership services ordered by display_order', async () => {
    const mockData = [
      { id: '1', name: 'Service 1', display_order: 1 },
      { id: '2', name: 'Service 2', display_order: 2 }
    ];

    const mockOrder = vi.fn().mockResolvedValue({ data: mockData, error: null });
    const mockEq = vi.fn().mockReturnValue({ order: mockOrder });
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
    (supabase.from as any).mockReturnValue({ select: mockSelect });

    const result = await getPartnershipServices();

    expect(supabase.from).toHaveBeenCalledWith('partnership_services');
    expect(mockSelect).toHaveBeenCalledWith('*');
    expect(mockEq).toHaveBeenCalledWith('is_active', true);
    expect(mockOrder).toHaveBeenCalledWith('display_order', { ascending: true });
    expect(result).toEqual(mockData);
  });

  it('should return empty array and log error on failure', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const mockError = { message: 'Database error' };

    const mockOrder = vi.fn().mockResolvedValue({ data: null, error: mockError });
    const mockEq = vi.fn().mockReturnValue({ order: mockOrder });
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
    (supabase.from as any).mockReturnValue({ select: mockSelect });

    const result = await getPartnershipServices();

    expect(result).toEqual([]);
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});
